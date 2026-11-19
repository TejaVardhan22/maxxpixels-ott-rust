import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {

  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authStore = inject(AuthStore);

  private requiredPermission = '';
  private isCreated = false;

  @Input() set appHasPermission(permission: string) {
    this.requiredPermission = permission;
    this.updateView();
  }

  constructor() {
    effect(() => {
      // Re-evaluate when permissions signal changes
      this.authStore.permissions();
      this.updateView();
    });
  }

  private updateView(): void {
    const hasPerm = this.authStore.hasPermission(this.requiredPermission);

    if (hasPerm && !this.isCreated) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.isCreated = true;
    } else if (!hasPerm && this.isCreated) {
      this.viewContainer.clear();
      this.isCreated = false;
    }
  }
}
