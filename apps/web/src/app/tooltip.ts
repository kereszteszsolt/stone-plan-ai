// SPDX-FileCopyrightText: 2026 Keresztes Zsolt <https://kereszteszsolt.hu>
// SPDX-License-Identifier: Apache-2.0

import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, inject, input, type OnDestroy } from '@angular/core';

let nextTooltipId = 0;

@Directive({
  selector: '[appTooltip]',
  standalone: true,
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'scheduleHide()',
    '(focus)': 'show()',
    '(blur)': 'scheduleHide()',
  },
})
export class Tooltip implements OnDestroy {
  private static active: Tooltip | null = null;
  readonly appTooltip = input.required<string>();
  readonly appTooltipWidth = input<number>();
  private readonly anchor = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private bubble: HTMLDivElement | null = null;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private previousDescription: string | null = null;
  private readonly hideOnViewportChange = () => this.hide();
  private readonly dismissOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.dismiss(event);
  };
  private dialog: HTMLDialogElement | null = null;

  show(): void {
    clearTimeout(this.hideTimer);
    if (this.bubble || !this.appTooltip()) return;
    Tooltip.active?.hide();
    Tooltip.active = this;
    const bubble = this.document.createElement('div');
    bubble.id = `link-tooltip-${++nextTooltipId}`;
    bubble.className = 'link-tooltip';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = this.appTooltip();
    bubble.addEventListener('mouseenter', () => clearTimeout(this.hideTimer));
    bubble.addEventListener('mouseleave', () => this.scheduleHide());
    // A native modal's top layer must also contain its tooltip.
    const dialog = this.anchor.closest('dialog');
    this.dialog = dialog;
    (dialog ?? this.document.body).append(bubble);
    this.bubble = bubble;
    this.previousDescription = this.anchor.getAttribute('aria-describedby');
    this.anchor.setAttribute('aria-describedby', [this.previousDescription, bubble.id].filter(Boolean).join(' '));

    const view = this.document.defaultView!;
    const bounds = dialog?.getBoundingClientRect();
    const leftEdge = Math.max(10, (bounds?.left ?? 0) + 10);
    const rightEdge = Math.min(view.innerWidth - 10, (bounds?.right ?? view.innerWidth) - 10);
    const topEdge = Math.max(10, (bounds?.top ?? 0) + 10);
    const bottomEdge = Math.min(view.innerHeight - 10, (bounds?.bottom ?? view.innerHeight) - 10);
    const preferredWidth = this.appTooltipWidth();
    const maxWidth = Math.max(0, Math.min(preferredWidth ?? 304, rightEdge - leftEdge));
    bubble.style.maxWidth = `${maxWidth}px`;
    if (preferredWidth) bubble.style.width = `${maxWidth}px`;
    const target = this.anchor.getBoundingClientRect();
    const size = bubble.getBoundingClientRect();
    const center = target.left + target.width / 2;
    const left = Math.max(leftEdge, Math.min(center - size.width / 2, rightEdge - size.width));
    const above = target.top - size.height - 12 >= topEdge;
    bubble.classList.toggle('below', !above);
    bubble.style.left = `${left}px`;
    const top = above ? target.top - size.height - 12 : target.bottom + 12;
    bubble.style.top = `${Math.max(topEdge, Math.min(top, bottomEdge - size.height))}px`;
    bubble.style.setProperty('--tooltip-arrow', `${Math.max(12, Math.min(center - left, size.width - 12))}px`);
    view.addEventListener('resize', this.hideOnViewportChange);
    this.document.addEventListener('scroll', this.hideOnViewportChange, true);
    this.document.addEventListener('keydown', this.dismissOnEscape, true);
    dialog?.addEventListener('close', this.hideOnViewportChange);
  }

  scheduleHide(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (!this.anchor.matches(':hover, :focus') && !this.bubble?.matches(':hover')) this.hide();
    }, 120);
  }

  dismiss(event: Event): void {
    if (!this.bubble) return;
    event.preventDefault();
    event.stopPropagation();
    this.hide();
  }

  private hide(): void {
    clearTimeout(this.hideTimer);
    if (!this.bubble) return;
    this.bubble.remove();
    this.bubble = null;
    if (Tooltip.active === this) Tooltip.active = null;
    if (this.previousDescription) this.anchor.setAttribute('aria-describedby', this.previousDescription);
    else this.anchor.removeAttribute('aria-describedby');
    this.document.defaultView?.removeEventListener('resize', this.hideOnViewportChange);
    this.document.removeEventListener('scroll', this.hideOnViewportChange, true);
    this.document.removeEventListener('keydown', this.dismissOnEscape, true);
    this.dialog?.removeEventListener('close', this.hideOnViewportChange);
    this.dialog = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
