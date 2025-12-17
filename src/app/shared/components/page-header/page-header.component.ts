import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { LucideAngularModule, LogOut } from 'lucide-angular';
import { LogoComponent } from '../logo/logo.component';
import { WaveBackgroundComponent } from '../wave-background/wave-background.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, ButtonComponent, TooltipDirective, LucideAngularModule, LogoComponent, WaveBackgroundComponent],
  template: `
    <header class="relative">
      <!-- Анимированный фон -->
      <app-wave-background></app-wave-background>

      <!-- Контент хедера -->
      <div class="relative z-10 container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <!-- Logo & Title -->
          <app-logo></app-logo>
          
          <!-- User Info & Actions -->
          @if (showUserInfo && user) {
            <div class="flex items-center gap-4">
              <div class="text-right">
                <p class="text-white/90 font-medium">{{ user.displayName || user.username }}</p>
                <p class="text-white/40 text-sm">@{{ user.username }}</p>
              </div>
              
              @if (showLogout) {
                <app-button
                  variant="ghost"
                  size="sm"
                  (clicked)="onLogout()"
                  [appTooltip]="'Выйти из аккаунта'"
                  tooltipPosition="bottom"
                >
                  <lucide-icon [img]="LogOut" [size]="18"></lucide-icon>
                  Выйти
                </app-button>
              }
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: []
})
export class PageHeaderComponent {
  @Input() showUserInfo = false;
  @Input() showLogout = false;
  @Input() user: any = null;
  
  @Output() logout = new EventEmitter<void>();

  readonly LogOut = LogOut;

  onLogout(): void {
    this.logout.emit();
  }
}

