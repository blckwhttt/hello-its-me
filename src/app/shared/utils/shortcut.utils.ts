import { PushToTalkShortcut } from '../../core/services/webrtc.service';

interface ShortcutFormatOptions {
  isMac?: boolean;
  fallbackLabel?: string;
}

export function formatShortcutLabel(
  shortcut?: PushToTalkShortcut,
  options?: ShortcutFormatOptions
): string {
  if (!shortcut) {
    return options?.fallbackLabel ?? 'Не задано';
  }

  const isMac =
    options?.isMac ?? (typeof navigator !== 'undefined' && /mac/i.test(navigator.platform));

  const parts: string[] = [];

  if (shortcut.ctrlKey) {
    parts.push('Ctrl');
  }
  if (shortcut.altKey) {
    parts.push(isMac ? 'Option' : 'Alt');
  }
  if (shortcut.shiftKey) {
    parts.push('Shift');
  }
  if (shortcut.metaKey) {
    parts.push(isMac ? 'Cmd' : 'Win');
  }

  parts.push(mapCodeToLabel(shortcut.code));

  return parts.join(' + ');
}

function mapCodeToLabel(code: string): string {
  if (!code) {
    return '—';
  }

  if (code.startsWith('Key')) {
    return code.replace('Key', '').toUpperCase();
  }

  if (code.startsWith('Digit')) {
    return code.replace('Digit', '');
  }

  const lookup: Record<string, string> = {
    Space: 'Space',
    Backslash: '\\',
    Slash: '/',
    Period: '.',
    Comma: ',',
    Quote: "'",
    Semicolon: ';',
    BracketLeft: '[',
    BracketRight: ']',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    CapsLock: 'Caps Lock',
    Tab: 'Tab',
    Escape: 'Esc',
    Enter: 'Enter',
    NumpadEnter: 'Num Enter',
  };

  return lookup[code] || code;
}
