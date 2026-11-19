import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { BunnyService } from '../../../infrastructure/storage/bunny.service';

export interface BackupArtifact {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  location: string;
  cdnUrl?: string;
}

@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);
  private readonly backupDir = path.join(process.cwd(), 'backups');

  constructor(
    private readonly dataSource: DataSource,
    private readonly bunnyService: BunnyService,
  ) {}

  /**
   * Nightly automated PostgreSQL backup at 01:00 AM server time.
   * Override with BACKUP_CRON env (6-field cron, e.g. "0 30 19 * * *" = 1:00 AM IST on a UTC server).
   */
  @Cron(process.env.BACKUP_CRON || '0 0 1 * * *')
  async runNightlyBackup(): Promise<void> {
    try {
      await this.triggerBackup('SCHEDULED_CRON');
    } catch (err: any) {
      this.logger.error(`Nightly database backup failed: ${err.message}`);
    }
  }

  async triggerBackup(initiatedBy = 'MANUAL_ADMIN'): Promise<BackupArtifact> {
    await fs.promises.mkdir(this.backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // FULL backup via pg_dump (complete, restorable database dump)
    let sqlBuffer: Buffer;
    let backupKind: 'FULL' | 'PARTIAL_FALLBACK' = 'FULL';
    try {
      sqlBuffer = await this.runPgDump();
      this.logger.log(`pg_dump completed: ${sqlBuffer.length} bytes`);
    } catch (err: any) {
      this.logger.error(`pg_dump FAILED (${err?.message || err}) — falling back to LIMITED partial dump (NOT a full backup!)`);
      backupKind = 'PARTIAL_FALLBACK';
      sqlBuffer = await this.buildPartialDumpSql(initiatedBy);
    }

    const fileName = `maxxott-backup-${backupKind === 'FULL' ? '' : 'PARTIAL-'}${timestamp}.sql.gz`;
    const filePath = path.join(this.backupDir, fileName);
    const compressed = await new Promise<Buffer>((resolve, reject) =>
      zlib.gzip(sqlBuffer, (e, out) => (e ? reject(e) : resolve(out))),
    );
    await fs.promises.writeFile(filePath, compressed);

    let uploadedUrl: string | undefined;
    try {
      const uploadRes = await this.bunnyService.uploadToStorage(
        'db-backups',
        fileName,
        compressed,
        'application/gzip',
      );
      uploadedUrl = uploadRes.url;
      this.logger.log(`Database backup (${backupKind}) uploaded to Bunny storage: ${fileName}`);
    } catch (err: any) {
      // Keep local backup, but never fail silently
      this.logger.error(`Bunny storage upload FAILED for ${fileName}: ${err?.message || err}`);
    }

    await this.pruneOldBackups(7);

    return {
      fileName,
      sizeBytes: compressed.length,
      createdAt: new Date().toISOString(),
      location: filePath,
      cdnUrl: uploadedUrl,
    };
  }

  /**
   * Runs a real pg_dump (plain SQL, restorable with psql) using the TypeORM connection settings.
   * Binary location can be forced with PGDUMP_PATH (e.g. /usr/lib/postgresql/16/bin/pg_dump).
   */
  private async runPgDump(): Promise<Buffer> {
    const opts = this.dataSource.options as any;
    const host = opts?.host || '127.0.0.1';
    const port = String(opts?.port || 5432);
    const user = opts?.username || 'postgres';
    const database = opts?.database;
    if (!database) throw new Error('No database configured on the DataSource');

    const pgDumpPath = process.env.PGDUMP_PATH || 'pg_dump';
    const args = ['-h', host, '-p', port, '-U', user, '-d', database, '--no-owner', '--no-privileges'];

    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn(pgDumpPath, args, {
        env: { ...process.env, PGPASSWORD: opts?.password || process.env.DB_PASSWORD || '' },
      });

      const chunks: Buffer[] = [];
      let stderr = '';
      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      child.on('error', (e) => reject(new Error(`pg_dump could not be started (${e.message}). Install PostgreSQL client tools or set PGDUMP_PATH.`)));
      child.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(chunks));
        else reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim().slice(0, 500)}`));
      });
    });
  }

  /**
   * Legacy partial dump — only used as an emergency fallback when pg_dump is unavailable.
   * Covers a small subset of tables with a row cap; NOT a full recovery backup.
   */
  private async buildPartialDumpSql(initiatedBy: string): Promise<Buffer> {
    const sqlStatements: string[] = [
      `-- MaxxPixels OTT PARTIAL FALLBACK BACKUP (INCOMPLETE — pg_dump unavailable)`,
      `-- Generated At: ${new Date().toISOString()}`,
      `-- Initiated By: ${initiatedBy}`,
      `SET statement_timeout = 0;`,
      `SET client_encoding = 'UTF8';`,
      ``,
    ];

    if (this.dataSource.isInitialized) {
      const tables = [
        'roles',
        'permissions',
        'languages',
        'genres',
        'content_types',
        'categories',
        'plans',
        'system_settings',
        'legal_pages',
        'drm_rules',
        'contents',
        'movies',
        'series',
      ];

      for (const table of tables) {
        try {
          const rows = await this.dataSource.query(`SELECT * FROM ${table} LIMIT 5000`);
          sqlStatements.push(`-- Table: ${table} (${rows.length} rows)`);
          for (const row of rows) {
            const cols = Object.keys(row).map((c) => `"${c}"`).join(', ');
            const vals = Object.values(row)
              .map((v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`))
              .join(', ');
            sqlStatements.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
          }
          sqlStatements.push('');
        } catch {
          // Table might not exist in mock test mode
        }
      }
    }

    return Buffer.from(sqlStatements.join('\n'), 'utf-8');
  }

  async listBackups(): Promise<BackupArtifact[]> {
    try {
      await fs.promises.mkdir(this.backupDir, { recursive: true });
      const files = await fs.promises.readdir(this.backupDir);
      const artifacts: BackupArtifact[] = [];

      for (const f of files) {
        if (f.endsWith('.sql.gz') || f.endsWith('.sql')) {
          const fullPath = path.join(this.backupDir, f);
          const stat = await fs.promises.stat(fullPath);
          artifacts.push({
            fileName: f,
            sizeBytes: stat.size,
            createdAt: stat.mtime.toISOString(),
            location: fullPath,
          });
        }
      }

      return artifacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  private async pruneOldBackups(retentionDays = 7): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.backupDir);
      const cutoff = Date.now() - retentionDays * 86400 * 1000;
      for (const f of files) {
        const fullPath = path.join(this.backupDir, f);
        const stat = await fs.promises.stat(fullPath);
        if (stat.mtimeMs < cutoff) {
          await fs.promises.unlink(fullPath).catch(() => {});
        }
      }
    } catch {
      // ignore pruning errors
    }
  }
}

