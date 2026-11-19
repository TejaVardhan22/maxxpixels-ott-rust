import { Directive, ElementRef, HostListener, Input, Renderer2, inject } from '@angular/core';
import { Router } from '@angular/router';

@Directive({
  selector: '[appTvFocus]',
  standalone: true
})
export class TvFocusDirective {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly router = inject(Router);

  @Input() tvBackRoute?: string;

  @HostListener('focus')
  onFocus(): void {
    this.renderer.addClass(this.el.nativeElement, 'tv-focused');
    this.el.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  @HostListener('blur')
  onBlur(): void {
    this.renderer.removeClass(this.el.nativeElement, 'tv-focused');
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Enter':
        this.el.nativeElement.click();
        break;
      case 'Escape':
      case 'Backspace':
        if (this.tvBackRoute) {
          this.router.navigate([this.tvBackRoute]);
        }
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'ArrowDown':
      case 'ArrowUp':
        this.navigateFocus(event.key);
        break;
    }
  }

  private navigateFocus(key: string): void {
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>('[appTvFocus], button, a, input, select')
    );
    const index = focusable.indexOf(this.el.nativeElement);
    if (index === -1) return;

    let nextIndex = index;
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      nextIndex = (index + 1) % focusable.length;
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      nextIndex = (index - 1 + focusable.length) % focusable.length;
    }

    focusable[nextIndex]?.focus();
  }
}
