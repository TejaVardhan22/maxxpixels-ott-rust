import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../shared/services/notification.service';
import Quill from 'quill';

interface LegalPageDefinition {
  slug: string;
  label: string;
  description: string;
  icon: string;
}

const STARTER_TEMPLATES: Record<string, string> = {
  'privacy-policy': `<h2>Privacy Policy</h2><p>Last updated: ${new Date().toLocaleDateString()}</p><p>MaxxPixels OTT respects your privacy and is committed to protecting your personal information.</p><h3>1. Information We Collect</h3><ul><li>Name, mobile number, and optional email address during registration.</li><li>Watch history, preferences, and device session information to improve streaming quality.</li></ul><h3>2. How We Use Information</h3><p>We use your data strictly to authenticate your account, deliver personalized streaming recommendations, process subscriptions/rentals, and prevent fraud.</p><h3>3. Contact Us</h3><p>For any privacy requests or data deletion inquiries, contact our support team.</p>`,
  'terms-of-service': `<h2>Terms &amp; Conditions</h2><p>By creating an account or streaming content on MaxxPixels OTT, you agree to these terms.</p><h3>1. Account &amp; Eligibility</h3><p>You are responsible for maintaining the confidentiality of your login credentials and active device sessions.</p><h3>2. Subscriptions &amp; Rentals</h3><p>SVOD plans renew according to your chosen billing cycle. TVOD rentals remain accessible for the stated validity window after purchase.</p><h3>3. Acceptable Use</h3><p>All streams are licensed for personal, non-commercial viewing only. Screen recording, redistribution, or circumventing DRM is strictly prohibited.</p>`,
  'refund-policy': `<h2>Refund &amp; Cancellation Policy</h2><h3>1. Subscription Cancellation</h3><p>You may cancel auto-renewal at any time from Account Settings. Your access continues until the end of your current billing period.</p><h3>2. Refund Eligibility</h3><p>Duplicate charges or technical billing errors verified within 7 days are refunded to the original payment method within 5–7 business days.</p>`,
  'cookie-policy': `<h2>Cookie Policy</h2><p>MaxxPixels OTT uses essential cookies and local storage to keep you signed in, remember subtitle/language preferences, and resume playback where you left off.</p>`,
  'about-us': `<h2>About MaxxPixels OTT</h2><p>MaxxPixels is a next-generation streaming platform bringing movies, web series, microdramas, short films, music, and live entertainment directly to your web browser, mobile device, and smart TV.</p>`,
  'contact-us': `<h2>Contact Support</h2><p>Need help with your account, subscription, or playback? Reach out to our team:</p><ul><li><strong>Support Hours:</strong> Monday – Sunday, 9:00 AM – 9:00 PM IST</li><li><strong>Help Center:</strong> Visit your account dashboard to raise a ticket</li></ul>`,
  'grievance-redressal': `<h2>Grievance Redressal Officer</h2><p>In accordance with applicable Digital Media &amp; Information Technology guidelines, content or compliance grievances may be submitted with your name, contact details, title name, and description of the concern. We acknowledge all grievances within 24 hours and resolve them within 15 days.</p>`
};

@Component({
  selector: 'app-legal-pages',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatInputModule, MatTooltipModule],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>gavel</mat-icon> LEGAL &amp; COMPLIANCE CMS</span>
          <h1>Legal Pages</h1>
          <p>Edit policies displayed on Web &amp; Mobile using starter templates and live viewer preview.</p>
        </div>
        <button mat-raised-button type="button" class="add-button" (click)="startNewPage()">
          <mat-icon>add</mat-icon> Add Legal Page
        </button>
      </div>

      <div class="legal-layout">
        <!-- LEFT SIDEBAR: PAGES LIST -->
        <aside class="page-list">
          <div class="list-heading">Policy Pages ({{ definitions.length }})</div>
          <button
            *ngFor="let page of definitions"
            type="button"
            class="page-tab"
            [class.active]="!creating && page.slug === selected.slug"
            (click)="selectPage(page)">
            <mat-icon>{{ page.icon }}</mat-icon>
            <span>
              <strong>{{ page.label }}</strong>
              <small>{{ page.description }}</small>
            </span>
            <span class="status" [class.live]="loadedSlugs.has(page.slug)">
              {{ loadedSlugs.has(page.slug) ? 'LIVE' : 'DRAFT' }}
            </span>
          </button>
        </aside>

        <!-- RIGHT CARD: EDITOR + LIVE PREVIEW -->
        <section class="editor-card">
          <div class="editor-header">
            <div class="editor-header-left">
              <div class="icon-box"><mat-icon>{{ selected.icon }}</mat-icon></div>
              <div>
                <h2>{{ creating ? 'Create Legal Page' : selected.label }}</h2>
                <div class="meta-pills">
                  <span class="meta-pill"><mat-icon>text_fields</mat-icon> {{ wordCount }} words</span>
                  <span class="meta-pill dirty" *ngIf="hasUnsavedChanges"><mat-icon>edit</mat-icon> Unsaved changes</span>
                  <span class="meta-pill saved" *ngIf="!hasUnsavedChanges && loadedSlugs.has(form.value.slug || '')">
                    <mat-icon>check_circle</mat-icon> Live on Web &amp; App
                  </span>
                </div>
              </div>
            </div>

            <div class="header-tools">
              <button
                type="button"
                class="tool-btn"
                (click)="insertStarterTemplate()"
                matTooltip="Insert a ready-to-edit OTT policy template">
                <mat-icon>auto_fix_high</mat-icon> Use Template
              </button>
              <div class="mode-switch">
                <button type="button" [class.active]="viewMode === 'edit'" (click)="viewMode = 'edit'">
                  <mat-icon>edit</mat-icon> Edit
                </button>
                <button type="button" [class.active]="viewMode === 'preview'" (click)="viewMode = 'preview'">
                  <mat-icon>visibility</mat-icon> Preview
                </button>
              </div>
            </div>
          </div>

          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="title-slug-row">
              <mat-form-field appearance="outline" class="title-field">
                <mat-label>Page Title *</mat-label>
                <input matInput formControlName="title" required maxlength="150" (input)="onTitleChange()" placeholder="e.g. Privacy Policy">
              </mat-form-field>

              <button type="button" class="slug-toggle-btn" (click)="showSlugField = !showSlugField">
                <mat-icon>link</mat-icon>
                <span>/legal/{{ form.value.slug || 'page-url' }}</span>
                <mat-icon class="small-arrow">{{ showSlugField ? 'expand_less' : 'edit' }}</mat-icon>
              </button>
            </div>

            <mat-form-field appearance="outline" class="full-width" *ngIf="showSlugField || creating">
              <mat-label>Public URL Slug *</mat-label>
              <input matInput formControlName="slug" required maxlength="150" placeholder="e.g. privacy-policy" (input)="normalizeSlug()">
              <mat-hint>Auto-generated from title. Public link: /legal/{{ form.value.slug || 'your-slug' }}</mat-hint>
              <mat-error *ngIf="form.controls.slug.hasError('pattern')">Use lowercase letters, numbers, and hyphens only.</mat-error>
            </mat-form-field>

            <!-- EDIT MODE -->
            <div [hidden]="viewMode !== 'edit'">
              <div class="editor-label">
                <mat-icon>edit_note</mat-icon>
                <span>Policy Content</span>
                <span class="helper-chip">Supports headings, lists, links &amp; formatting</span>
              </div>

              <div class="quill-wrapper" [class.quill-focused]="editorFocused">
                <div #quillEditor></div>
              </div>
            </div>

            <!-- LIVE VIEWER PREVIEW MODE -->
            <div *ngIf="viewMode === 'preview'" class="preview-box">
              <div class="preview-banner">
                <mat-icon>visibility</mat-icon>
                <span>Viewer Preview — This is how <strong>{{ form.value.title || 'Untitled Page' }}</strong> appears on Web &amp; Mobile</span>
              </div>
              <div class="preview-content" [innerHTML]="previewHtml"></div>
              <p *ngIf="!form.value.content" class="preview-empty">No content yet. Click "Use Template" or switch to Edit to write this policy.</p>
            </div>

            <div class="actions">
              <button type="button" class="copy-url-btn" (click)="copyPublicPath()" [disabled]="!form.value.slug">
                <mat-icon>content_copy</mat-icon> Copy Path: /legal/{{ form.value.slug || '...' }}
              </button>
              <button mat-raised-button type="submit" class="publish-btn" [disabled]="form.invalid || saving">
                <mat-icon>{{ saving ? 'sync' : 'publish' }}</mat-icon>
                {{ saving ? 'Publishing...' : 'Save & Publish Live' }}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .page-container { color: #fff; padding: 4px; max-width: 1360px; margin: 0 auto; }

    .header-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: 20px; margin-bottom: 22px; flex-wrap: wrap;
    }
    .add-button {
      color: #fff !important;
      background: linear-gradient(135deg, #e50914, #f43f5e) !important;
      font-weight: 800 !important;
      height: 42px;
      border-radius: 10px !important;
    }
    .category-tag {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(229, 9, 20, 0.14); color: #f43f5e;
      font-size: 11px; font-weight: 800; padding: 5px 10px;
      border-radius: 6px; letter-spacing: 0.5px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    h1 { font-size: 26px; font-weight: 800; margin: 8px 0 4px; }
    p { color: #94a3b8; margin: 0; font-size: 13px; }

    .legal-layout {
      display: grid;
      grid-template-columns: minmax(250px, 310px) minmax(0, 1fr);
      gap: 20px;
    }
    .page-list, .editor-card {
      background: #12141e; border: 1px solid #222638;
      border-radius: 16px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
    }
    .page-list { padding: 12px; height: max-content; }
    .list-heading {
      font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
      color: #64748b; padding: 6px 10px 10px;
    }
    .page-tab {
      width: 100%; display: flex; align-items: center; gap: 11px;
      text-align: left; background: transparent; border: 1px solid transparent;
      color: #94a3b8; border-radius: 11px; padding: 11px 12px; cursor: pointer; margin-bottom: 4px;
      transition: all 0.15s;
    }
    .page-tab:hover { background: #1a1e2e; color: #fff; }
    .page-tab.active { background: rgba(229, 9, 20, 0.12); border-color: rgba(229, 9, 20, 0.4); color: #fff; }
    .page-tab.active mat-icon { color: #f43f5e; }
    .page-tab > span:nth-child(2) { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
    .page-tab strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .page-tab small { font-size: 11px; color: #64748b; }
    .status {
      font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 999px;
      background: rgba(245, 158, 11, 0.15); color: #fbbf24;
    }
    .status.live { background: rgba(16, 185, 129, 0.15); color: #34d399; }

    .editor-card { padding: 24px; min-width: 0; }
    .editor-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      flex-wrap: wrap; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #222638;
    }
    .editor-header-left { display: flex; align-items: center; gap: 13px; }
    .icon-box {
      display: grid; place-items: center; width: 46px; height: 46px; border-radius: 12px;
      background: rgba(229, 9, 20, 0.14); color: #f43f5e;
    }
    .editor-header h2 { margin: 0 0 4px; font-size: 19px; font-weight: 800; }
    .meta-pills { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .meta-pill {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8;
      background: #1a1e2e; padding: 3px 9px; border-radius: 999px; font-weight: 600;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      &.dirty { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
      &.saved { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    }

    .header-tools { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .tool-btn {
      display: inline-flex; align-items: center; gap: 5px; background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35); color: #7dd3fc; border-radius: 9px;
      padding: 7px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: rgba(56, 189, 248, 0.22); }
    }
    .mode-switch {
      display: inline-flex; background: #0d0f17; border: 1px solid #262b40; border-radius: 9px; padding: 3px;
      button {
        display: inline-flex; align-items: center; gap: 5px; background: transparent; border: none;
        color: #94a3b8; padding: 5px 12px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
        &.active { background: #e50914; color: #fff; }
      }
    }

    .title-slug-row { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
    .title-field { flex: 1; min-width: 240px; }
    .slug-toggle-btn {
      display: inline-flex; align-items: center; gap: 6px; height: 54px; padding: 0 14px;
      background: #181c2b; border: 1px solid #2a2f45; border-radius: 10px; color: #94a3b8;
      font-family: monospace; font-size: 12px; cursor: pointer;
      &:hover { border-color: #475569; color: #fff; }
      .small-arrow { font-size: 16px; width: 16px; height: 16px; }
    }
    .full-width { width: 100%; margin-bottom: 10px; }

    .editor-label {
      display: flex; align-items: center; gap: 7px; font-size: 12px; color: #cbd5e1; font-weight: 700; margin: 4px 0 10px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #f43f5e; }
      .helper-chip { margin-left: auto; font-size: 11px; color: #64748b; font-weight: 500; }
    }

    .quill-wrapper {
      border: 1px solid #2e344c; border-radius: 10px; overflow: hidden; margin-bottom: 14px;
      transition: border-color 0.2s;
      &.quill-focused { border-color: #e50914; box-shadow: 0 0 0 2px rgba(229, 9, 20, 0.2); }
    }
    ::ng-deep .ql-toolbar { background: #191d2d !important; border: none !important; border-bottom: 1px solid #2a2f45 !important; }
    ::ng-deep .ql-toolbar .ql-stroke { stroke: #cbd5e1 !important; }
    ::ng-deep .ql-toolbar .ql-fill { fill: #cbd5e1 !important; }
    ::ng-deep .ql-toolbar .ql-picker-label { color: #cbd5e1 !important; }
    ::ng-deep .ql-toolbar button:hover .ql-stroke, ::ng-deep .ql-toolbar button.ql-active .ql-stroke { stroke: #f43f5e !important; }
    ::ng-deep .ql-toolbar button:hover .ql-fill, ::ng-deep .ql-toolbar button.ql-active .ql-fill { fill: #f43f5e !important; }
    ::ng-deep .ql-toolbar .ql-picker-options { background: #191d2d !important; border-color: #2a2f45 !important; color: #fff !important; }
    ::ng-deep .ql-container { background: #0d0f17 !important; border: none !important; font-family: 'Inter', sans-serif !important; font-size: 14px !important; }
    ::ng-deep .ql-editor { min-height: 340px !important; color: #e2e8f0 !important; line-height: 1.75 !important; }
    ::ng-deep .ql-editor.ql-blank::before { color: #64748b !important; font-style: italic !important; }
    ::ng-deep .ql-editor h1, ::ng-deep .ql-editor h2, ::ng-deep .ql-editor h3 { color: #fff !important; }
    ::ng-deep .ql-editor a { color: #38bdf8 !important; }

    .preview-box {
      background: #0d0f17; border: 1px solid #262b40; border-radius: 12px; padding: 20px 24px;
      min-height: 360px; margin-bottom: 14px;
      .preview-banner {
        display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px;
        background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25);
        color: #7dd3fc; font-size: 12px; margin-bottom: 18px;
        mat-icon { font-size: 17px; width: 17px; height: 17px; }
      }
      .preview-content { color: #e2e8f0; line-height: 1.75; font-size: 14px; }
      .preview-empty { color: #64748b; font-style: italic; font-size: 13px; }
    }

    .actions {
      display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
      padding-top: 10px; border-top: 1px solid #222638;
    }
    .copy-url-btn {
      display: inline-flex; align-items: center; gap: 6px; background: #181c2b;
      border: 1px solid #2a2f45; color: #94a3b8; border-radius: 9px; padding: 9px 14px;
      font-family: monospace; font-size: 12px; cursor: pointer;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover:not([disabled]) { color: #fff; border-color: #475569; }
    }
    .publish-btn {
      height: 44px; padding: 0 22px !important; color: #fff !important;
      background: linear-gradient(135deg, #e50914, #f43f5e) !important;
      font-weight: 800 !important; border-radius: 10px !important;
    }

    @media (max-width: 900px) {
      .legal-layout { grid-template-columns: 1fr; }
    }
  `]
})
export class LegalPagesPage implements OnInit, AfterViewInit {
  @ViewChild('quillEditor') quillEditorEl?: ElementRef<HTMLDivElement>;
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);

  private quill?: Quill;
  editorFocused = false;
  viewMode: 'edit' | 'preview' = 'edit';
  showSlugField = false;
  hasUnsavedChanges = false;
  private lastSavedContent = '';

  definitions: LegalPageDefinition[] = [
    { slug: 'privacy-policy', label: 'Privacy Policy', description: 'Personal data & privacy', icon: 'privacy_tip' },
    { slug: 'terms-of-service', label: 'Terms & Conditions', description: 'Subscriber & platform terms', icon: 'description' },
    { slug: 'refund-policy', label: 'Refund & Cancellation', description: 'Billing, refunds & cancels', icon: 'currency_exchange' },
    { slug: 'cookie-policy', label: 'Cookie Policy', description: 'Cookies & local storage', icon: 'cookie' },
    { slug: 'about-us', label: 'About Us', description: 'Company & platform info', icon: 'business' },
    { slug: 'contact-us', label: 'Contact Us', description: 'Customer support details', icon: 'contact_support' },
    { slug: 'grievance-redressal', label: 'Grievance Redressal', description: 'Compliance & officer', icon: 'account_balance' }
  ];
  selected = this.definitions[0];
  loadedSlugs = new Set<string>();
  creating = false;
  saving = false;

  form = this.fb.group({
    title: [this.selected.label, [Validators.required, Validators.maxLength(150)]],
    slug: [this.selected.slug, [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    content: ['', Validators.required]
  });

  get wordCount(): number {
    const plain = (this.form.value.content || '').replace(/<[^>]*>/g, ' ').trim();
    return plain ? plain.split(/\s+/).length : 0;
  }

  get previewHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.form.value.content || '');
  }

  ngOnInit(): void {
    this.loadAll();
  }

  ngAfterViewInit(): void {
    this.initQuill();
  }

  private initQuill(): void {
    if (!this.quillEditorEl) return;
    this.quill = new Quill(this.quillEditorEl.nativeElement, {
      theme: 'snow',
      placeholder: 'Write your policy content here, or click "Use Template" above to start fast...',
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['blockquote', 'link'],
          ['clean']
        ]
      }
    });

    this.quill.on('text-change', () => {
      const html = this.quillEditorEl!.nativeElement.querySelector('.ql-editor')?.innerHTML || '';
      const value = html === '<p><br></p>' ? '' : html;
      this.form.controls.content.setValue(value);
      this.hasUnsavedChanges = value !== this.lastSavedContent;
    });

    this.quill.on('selection-change', (range) => {
      this.editorFocused = range !== null;
    });
  }

  async selectPage(page: LegalPageDefinition): Promise<void> {
    if (this.hasUnsavedChanges) {
      const discard = await this.notifications.confirm(
        'Unsaved Changes',
        'You have unsaved edits on this page. Switch without saving?',
        'Discard & Switch'
      );
      if (!discard) return;
    }
    this.creating = false;
    this.showSlugField = false;
    this.viewMode = 'edit';
    this.selected = page;
    this.loadPage(page);
  }

  async startNewPage(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const discard = await this.notifications.confirm(
        'Unsaved Changes',
        'Discard current unsaved edits and create a new legal page?',
        'Yes, Create New'
      );
      if (!discard) return;
    }
    this.creating = true;
    this.showSlugField = true;
    this.viewMode = 'edit';
    this.selected = { slug: '', label: 'New Legal Page', description: 'Custom legal page', icon: 'note_add' };
    this.form.reset({ title: '', slug: '', content: '' });
    this.lastSavedContent = '';
    this.hasUnsavedChanges = false;
    this.setEditorContent('');
  }

  onTitleChange(): void {
    if (this.creating) {
      const auto = (this.form.value.title || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      this.form.controls.slug.setValue(auto, { emitEvent: false });
    }
    this.hasUnsavedChanges = true;
  }

  insertStarterTemplate(): void {
    const slug = this.form.value.slug || this.selected.slug;
    const tpl =
      STARTER_TEMPLATES[slug] ||
      `<h2>${this.form.value.title || 'Policy Title'}</h2><p>Last updated: ${new Date().toLocaleDateString()}</p><p>Enter the details of this policy here.</p><h3>1. Overview</h3><p>Explain how this policy applies to MaxxPixels OTT viewers.</p>`;
    this.setEditorContent(tpl);
    this.hasUnsavedChanges = true;
    this.notifications.info('Starter template inserted. Customize it and click Save & Publish Live.');
  }

  copyPublicPath(): void {
    const path = `/legal/${this.form.value.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(path).then(() => {
        this.notifications.success(`Copied ${path}`);
      });
    }
  }

  private setEditorContent(html: string): void {
    if (this.quill) {
      this.quill.root.innerHTML = html || '';
      this.form.controls.content.setValue(html || '');
    }
  }

  normalizeSlug(): void {
    const normalized = (this.form.value.slug || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (normalized !== this.form.value.slug) {
      this.form.controls.slug.setValue(normalized, { emitEvent: false });
    }
  }

  private loadAll(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/legal`).subscribe({
      next: (response) => {
        for (const page of response.data || []) {
          this.loadedSlugs.add(page.slug);
          const existing = this.definitions.find((item) => item.slug === page.slug);
          if (existing) existing.label = page.title;
          else this.definitions.push({ slug: page.slug, label: page.title, description: 'Custom legal page', icon: 'article' });
        }
        this.loadPage(this.selected);
      },
      error: () => this.loadPage(this.selected)
    });
  }

  private loadPage(page: LegalPageDefinition): void {
    this.form.reset({ title: page.label, slug: page.slug, content: '' });
    this.lastSavedContent = '';
    this.hasUnsavedChanges = false;
    this.setEditorContent('');
    this.http.get<any>(`${environment.apiBaseUrl}/legal/${page.slug}`).subscribe({
      next: (response) => {
        const content = response.data?.content || '';
        this.form.patchValue({ title: response.data?.title || page.label, slug: page.slug, content });
        this.lastSavedContent = content;
        this.hasUnsavedChanges = false;
        this.setEditorContent(content);
      },
      error: () => {
        this.form.patchValue({ title: page.label, slug: page.slug, content: '' });
        this.lastSavedContent = '';
        this.hasUnsavedChanges = false;
        this.setEditorContent('');
      }
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    const slug = this.form.value.slug!;
    if (this.creating && this.loadedSlugs.has(slug)) {
      this.notifications.error('A legal page with this URL slug already exists.');
      return;
    }
    this.saving = true;
    const pageTitle = this.form.value.title!;
    const content = this.form.value.content || '';
    const payload = { title: pageTitle, content };

    this.http.put<any>(`${environment.apiBaseUrl}/legal/${slug}?title=${encodeURIComponent(pageTitle)}`, payload).subscribe({
      next: () => {
        this.loadedSlugs.add(slug);
        let page = this.definitions.find((item) => item.slug === slug);
        if (!page) {
          page = { slug, label: pageTitle, description: 'Custom legal page', icon: 'article' };
          this.definitions.push(page);
        } else {
          page.label = pageTitle;
        }
        this.selected = page;
        this.creating = false;
        this.showSlugField = false;
        this.saving = false;
        this.lastSavedContent = content;
        this.hasUnsavedChanges = false;
        this.notifications.success(`"${pageTitle}" published live to Web & Mobile.`);
      },
      error: (err) => {
        this.saving = false;
        this.notifications.error(err?.error?.message || `Unable to publish ${pageTitle}.`);
      }
    });
  }
}
