import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background-color: #121216;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'MaxxPixels OTT Admin';
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if ((hostname.startsWith('producer') || hostname.includes('producer.')) && (window.location.pathname === '/' || window.location.pathname === '')) {
        this.router.navigate(['/producer/dashboard']);
      }
    }
  }
}
