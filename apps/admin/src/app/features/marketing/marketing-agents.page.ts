import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  MarketingAgentApiService,
  MarketingAgent,
  MarketingMember,
} from '../../core/services/marketing-agent-api.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-marketing-agents-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  template: `
    <div class="marketing-page">
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>campaign</mat-icon> GROWTH &amp; REFERRALS</span>
          <h1>Marketing Agents</h1>
          <p>Onboard agents with KYC, generate a unique code, and track every member they onboard.</p>
        </div>
        <button mat-raised-button class="add-btn" (click)="showForm = !showForm">
          <mat-icon>{{ showForm ? 'close' : 'person_add' }}</mat-icon>
          {{ showForm ? 'Close Form' : 'New Marketing Agent' }}
        </button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <mat-icon>groups</mat-icon>
          <div><span>Total Agents</span><strong>{{ agents.length }}</strong></div>
        </div>
        <div class="kpi-card">
          <mat-icon>person_add_alt</mat-icon>
          <div><span>Members Onboarded</span><strong>{{ totalMembers }}</strong></div>
        </div>
        <div class="kpi-card">
          <mat-icon>verified</mat-icon>
          <div><span>Active Agents</span><strong>{{ activeAgents }}</strong></div>
        </div>
      </div>

      <div class="success-banner" *ngIf="lastCreatedCode">
        <mat-icon>check_circle</mat-icon>
        <span>Agent created. Unique code: <strong>{{ lastCreatedCode }}</strong></span>
        <button mat-button (click)="copyCode(lastCreatedCode)"><mat-icon>content_copy</mat-icon> Copy</button>
      </div>

      <form class="editor-card" *ngIf="showForm" [formGroup]="agentForm" (ngSubmit)="onSubmit()">
        <h2><mat-icon>badge</mat-icon> Agent Details &amp; KYC</h2>
        <div class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="fullName" placeholder="Agent full name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Mobile Number</mat-label>
            <input matInput formControlName="mobileNumber" placeholder="10-digit mobile number" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" placeholder="agent@example.com" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Aadhaar Number (Optional)</mat-label>
            <input matInput formControlName="aadhaarNumber" placeholder="12-digit Aadhaar" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>PAN Number (Optional)</mat-label>
            <input matInput formControlName="panNumber" placeholder="ABCDE1234F" />
          </mat-form-field>
        </div>

        <div class="upload-grid">
          <div class="upload-card">
            <label>Aadhaar Card Upload *</label>
            <input #aadhaarInput type="file" accept="application/pdf,image/*" hidden (change)="onFileSelected($event, 'aadhaarDocUrl')" />
            <button type="button" mat-stroked-button (click)="aadhaarInput.click()" [disabled]="uploadingField === 'aadhaarDocUrl'">
              <mat-icon>upload_file</mat-icon>
              {{ uploadingField === 'aadhaarDocUrl' ? 'Uploading...' : 'Upload Aadhaar' }}
            </button>
            <a *ngIf="agentForm.get('aadhaarDocUrl')?.value" [href]="agentForm.get('aadhaarDocUrl')?.value" target="_blank">View uploaded file</a>
          </div>
          <div class="upload-card">
            <label>PAN Card Upload *</label>
            <input #panInput type="file" accept="application/pdf,image/*" hidden (change)="onFileSelected($event, 'panDocUrl')" />
            <button type="button" mat-stroked-button (click)="panInput.click()" [disabled]="uploadingField === 'panDocUrl'">
              <mat-icon>upload_file</mat-icon>
              {{ uploadingField === 'panDocUrl' ? 'Uploading...' : 'Upload PAN Card' }}
            </button>
            <a *ngIf="agentForm.get('panDocUrl')?.value" [href]="agentForm.get('panDocUrl')?.value" target="_blank">View uploaded file</a>
          </div>
        </div>

        <div class="form-actions">
          <button mat-raised-button color="primary" type="submit" [disabled]="agentForm.invalid || saving">
            {{ saving ? 'Creating...' : 'Create Agent & Generate Code' }}
          </button>
        </div>
      </form>

      <div class="table-card">
        <h2><mat-icon>list</mat-icon> Agent Directory</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Unique Code</th>
                <th>Contact</th>
                <th>Members</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let agent of agents">
                <td>
                  <strong>{{ agent.fullName }}</strong>
                  <small>Aadhaar: {{ agent.aadhaarNumber || '—' }} · PAN: {{ agent.panNumber || '—' }}</small>
                </td>
                <td>
                  <button mat-button class="code-chip" (click)="copyCode(agent.agentCode)" matTooltip="Copy code">
                    {{ agent.agentCode }} <mat-icon>content_copy</mat-icon>
                  </button>
                </td>
                <td>{{ agent.mobileNumber }}<small>{{ agent.email }}</small></td>
                <td><span class="member-count">{{ agent.memberCount || 0 }}</span></td>
                <td>
                  <span class="status" [class.inactive]="agent.status !== 'ACTIVE'">{{ agent.status }}</span>
                </td>
                <td>
                  <button mat-button (click)="viewMembers(agent)"><mat-icon>visibility</mat-icon> Members</button>
                  <button mat-button (click)="toggleStatus(agent)"><mat-icon>toggle_on</mat-icon> {{ agent.status === 'ACTIVE' ? 'Disable' : 'Enable' }}</button>
                </td>
              </tr>
              <tr *ngIf="!agents.length">
                <td colspan="6" class="empty">No marketing agents yet. Create one to generate a unique code.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="members-card" *ngIf="selectedAgent">
        <h2>
          <mat-icon>people</mat-icon>
          Members onboarded by {{ selectedAgent.fullName }}
          <button mat-icon-button (click)="selectedAgent = null"><mat-icon>close</mat-icon></button>
        </h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Phone</th><th>Email</th><th>Joined</th></tr></thead>
            <tbody>
              <tr *ngFor="let member of members">
                <td>{{ member.fullName || ('User #' + member.userId) }}</td>
                <td>{{ member.phoneNumber || '—' }}</td>
                <td>{{ member.email || '—' }}</td>
                <td>{{ member.joinedAt | date: 'medium' }}</td>
              </tr>
              <tr *ngIf="!members.length"><td colspan="4" class="empty">No members onboarded with this code yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .marketing-page { padding: 24px; color: #e9e9f2; }
    .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .category-tag { display: inline-flex; align-items: center; gap: 6px; color: #f5b301; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
    .category-tag mat-icon { font-size: 16px; width: 16px; height: 16px; }
    h1 { margin: 6px 0 4px; font-size: 28px; font-weight: 800; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; font-size: 17px; font-weight: 700; }
    p { margin: 0; color: #9a9aae; font-size: 13px; }
    .add-btn { background: #e50914 !important; color: #fff !important; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 18px; }
    .kpi-card { display: flex; align-items: center; gap: 14px; padding: 18px; background: #1a1a24; border: 1px solid #2a2a38; border-radius: 14px; }
    .kpi-card mat-icon { color: #f5b301; }
    .kpi-card span { display: block; color: #9a9aae; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .kpi-card strong { font-size: 26px; }
    .success-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin-bottom: 16px; border: 1px solid #2e7d46; background: rgba(46,125,70,.16); border-radius: 12px; color: #b7f0c6; }
    .success-banner mat-icon { color: #59d67d; }
    .editor-card, .table-card, .members-card { padding: 20px; background: #1a1a24; border: 1px solid #2a2a38; border-radius: 14px; margin-bottom: 18px; }
    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 16px; }
    .upload-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 8px 0 18px; }
    .upload-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px; border: 1px dashed #3a3a4c; border-radius: 12px; }
    .upload-card label { font-size: 12px; font-weight: 700; color: #c8c8d6; }
    .upload-card a { color: #f5b301; font-size: 12px; }
    .form-actions { display: flex; justify-content: flex-end; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; color: #8f8fa3; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; padding: 10px 12px; border-bottom: 1px solid #2f2f3e; }
    td { padding: 12px; border-bottom: 1px solid #262633; vertical-align: middle; }
    td small { display: block; color: #8f8fa3; margin-top: 3px; }
    .empty { text-align: center; color: #8f8fa3; padding: 28px; }
    .code-chip { font-family: monospace; font-weight: 800; color: #f5b301 !important; }
    .code-chip mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .member-count { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; padding: 4px 8px; border-radius: 999px; background: #2a2a3a; font-weight: 800; }
    .status { padding: 4px 10px; border-radius: 999px; background: rgba(89,214,125,.14); color: #59d67d; font-size: 11px; font-weight: 800; }
    .status.inactive { background: rgba(229,9,20,.14); color: #ff6b6b; }
    .members-card button[mat-icon-button] { margin-left: auto; color: #9a9aae; }
  `],
})
export class MarketingAgentsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MarketingAgentApiService);
  private readonly notify = inject(NotificationService);

  agents: MarketingAgent[] = [];
  members: MarketingMember[] = [];
  selectedAgent: MarketingAgent | null = null;
  showForm = false;
  saving = false;
  uploadingField: string | null = null;
  lastCreatedCode = '';

  readonly agentForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required]],
    mobileNumber: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    aadhaarNumber: [''],
    panNumber: [''],
    aadhaarDocUrl: ['', [Validators.required]],
    panDocUrl: ['', [Validators.required]],
  });

  get totalMembers(): number {
    return this.agents.reduce((sum, agent) => sum + Number(agent.memberCount || 0), 0);
  }

  get activeAgents(): number {
    return this.agents.filter((agent) => agent.status === 'ACTIVE').length;
  }

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.api.listAgents().subscribe({
      next: (response) => {
        this.agents = response.data || [];
      },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to load marketing agents'),
    });
  }

  onFileSelected(event: Event, field: 'aadhaarDocUrl' | 'panDocUrl'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingField = field;
    this.api.uploadDocument(file).subscribe({
      next: (response) => {
        const data: any = response.data;
        const url = data?.url || data?.fileUrl;
        if (url) {
          this.agentForm.patchValue({ [field]: url });
          this.notify.success('Document uploaded');
        }
        this.uploadingField = null;
        input.value = '';
      },
      error: (err) => {
        this.uploadingField = null;
        input.value = '';
        this.notify.error(err?.error?.message || 'Document upload failed');
      },
    });
  }

  onSubmit(): void {
    if (this.agentForm.invalid) return;
    this.saving = true;
    this.lastCreatedCode = '';
    this.api.createAgent(this.agentForm.getRawValue()).subscribe({
      next: (response) => {
        const created: any = response.data;
        this.lastCreatedCode = created?.agentCode || '';
        this.notify.success(`Marketing agent created with code ${this.lastCreatedCode}`);
        this.agentForm.reset({
          fullName: '',
          mobileNumber: '',
          email: '',
          aadhaarNumber: '',
          panNumber: '',
          aadhaarDocUrl: '',
          panDocUrl: '',
        });
        this.loadAgents();
        this.saving = false;
      },
      error: (err) => {
        this.saving = false;
        this.notify.error(err?.error?.message || 'Unable to create marketing agent');
      },
    });
  }

  viewMembers(agent: MarketingAgent): void {
    this.selectedAgent = agent;
    this.members = [];
    this.api.listMembers(agent.id!).subscribe({
      next: (response) => {
        this.members = response.data || [];
      },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to load members'),
    });
  }

  toggleStatus(agent: MarketingAgent): void {
    this.api.toggleStatus(agent.id!).subscribe({
      next: () => {
        this.notify.success('Agent status updated');
        this.loadAgents();
      },
      error: (err) => this.notify.error(err?.error?.message || 'Unable to update agent status'),
    });
  }

  copyCode(code: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(code);
      this.notify.success('Agent code copied');
    }
  }
}
