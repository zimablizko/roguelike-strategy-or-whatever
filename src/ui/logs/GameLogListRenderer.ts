import type { GameLogEntry } from '../../_common/models/log.models';
import { FONT_FAMILY } from '../../_common/text';

export function getGameLogSeverityColor(entry: GameLogEntry): string {
  switch (entry.severity) {
    case 'good':
      return '#9fe6aa';
    case 'bad':
      return '#f08b82';
    default:
      return '#f0f4f8';
  }
}

export function renderGameLogListItem(args: {
  ctx: CanvasRenderingContext2D;
  item: GameLogEntry;
  x: number;
  y: number;
  width: number;
  height: number;
}): void {
  const { ctx, item, x, y, width, height } = args;
  const padX = 10;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = '#8fa8c0';
  ctx.font = `11px ${FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  ctx.fillText(item.dateLabel, x + padX, y + 7);

  ctx.fillStyle = getGameLogSeverityColor(item);
  ctx.font = `13px ${FONT_FAMILY}`;

  const messageLines = wrapTextToWidth(
    ctx,
    item.message,
    width - padX * 2,
    2
  );
  for (const [index, line] of messageLines.entries()) {
    ctx.fillText(line, x + padX, y + 22 + index * 15);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(x, y + height - 1, width, 1);
}

function wrapTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let current = '';
  let wordIndex = 0;

  while (wordIndex < words.length) {
    const word = words[wordIndex];
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
      current = next;
      wordIndex++;
      continue;
    }

    lines.push(current);
    if (lines.length === maxLines - 1) {
      current = words.slice(wordIndex).join(' ');
      break;
    }
    current = '';
  }

  if (lines.length < maxLines && current.trim()) {
    lines.push(current);
  }

  if (wordIndex < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = ellipsizeToWidth(ctx, lines[lastIndex], maxWidth);
  }

  return lines;
}

function ellipsizeToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const suffix = '...';
  let trimmed = text.trim();

  while (ctx.measureText(`${trimmed}${suffix}`).width > maxWidth) {
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace <= 0) {
      trimmed = trimmed.slice(0, -1).trimEnd();
    } else {
      trimmed = trimmed.slice(0, lastSpace).trimEnd();
    }
    if (!trimmed) {
      return suffix;
    }
  }

  return `${trimmed}${suffix}`;
}
