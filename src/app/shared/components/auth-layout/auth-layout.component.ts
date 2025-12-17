import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-screen overflow-hidden relative flex items-stretch justify-between">
      <div class="p-[30px] pr-0 mr-5 flex flex-col">
        <div class="flex items-center gap-[32px] mb-[47px]">
          <div
            class="size-[124px] rounded-full relative overflow-hidden flex items-center select-none pointer-events-none"
          >
            <img src="1QWYKNOWGyTgjK2pdP5T.png" alt="" class="size-full object-cover" />
          </div>
          <div
            class="size-[124px] relative overflow-hidden flex items-center select-none pointer-events-none"
          >
            <img src="rfM3FTG6RqeTU4XyiX0w.png" alt="" class="size-full object-cover" />
          </div>
          <div
            class="size-[124px] rounded-[34px] relative overflow-hidden flex items-center select-none pointer-events-none"
          >
            <img src="f2ePyPCM8bkb5qQA5ZPz.png" alt="" class="size-full object-cover" />
          </div>
        </div>
        <div class="flex items-center select-none mb-[38px]">
          <img src="logo/logo-text-beta-big.svg" alt="Twine" class="max-w-[395px] size-auto" />
        </div>
        <p class="text-white/45 font-medium">Общайтесь свободно, весело и безопасно</p>

        <div class="mt-auto mb-[13px] flex gap-[8px] items-center text-[13px] text-white/35 font-medium">
          <a href="/legal/policy" target="_blank" class="hover:text-white/50 transition-colors">Политика конфиденциальности</a>
          <span>•</span>
          <a href="/legal/terms" target="_blank" class="hover:text-white/50 transition-colors">Условия использования</a>
        </div>
      </div>

      <div class="grid grid-cols-2 justify-end w-full max-w-[1336px]">
        <div class="bg-[#0D0D10] rounded-[84px] py-[48px] px-[100px] flex flex-col items-center">
          <img src="logo/logo-icon.svg" alt="Twine" class="size-[71px] block mb-[47px]" />
          <div class="relative w-full">
            <ng-content></ng-content>

            <div class="flex items-center justify-center mt-[44px]">
              <a [routerLink]="footerLink" class="text-white/45 text-[15px] font-medium hover:text-white/70 transition-all hover:underline underline-offset-4">{{ footerText }}</a>
            </div>
          </div>
        </div>

        <div
          class="bg-[#0D0D10] rounded-[84px] py-[48px] px-[100px] flex flex-col items-center"
        ></div>
      </div>
    </div>
  `,
  styles: [],
})
export class AuthLayoutComponent {
  @Input() footerText = '';
  @Input() footerLink = '';
}
