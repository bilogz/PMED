type DateTimeInput = Date | string | number | null | undefined;

type DateTimeFormatOptions = Intl.DateTimeFormatOptions & {
  fallback?: string;
};

const PHILIPPINES_TIMEZONE = 'Asia/Manila';
const PHILIPPINES_TIMEZONE_LABEL = 'GMT+8';

function parseDateTimeInput(value: DateTimeInput): Date {
  if (value instanceof Date) return value;
  const text = String(value ?? '').trim();
  if (!text) return new Date('');

  const normalized =
    /(?:Z|[+-]\d{2}:\d{2})$/i.test(text)
      ? text
      : /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/i.test(text)
        ? text.replace(' ', 'T') + 'Z'
        : text;

  return new Date(normalized);
}

export function getTimezoneLabel(_value: DateTimeInput = new Date()): string {
  return PHILIPPINES_TIMEZONE_LABEL;
}

export function formatDateTimeWithTimezone(
  value: DateTimeInput,
  options: DateTimeFormatOptions = {}
): string {
  const parsed = parseDateTimeInput(value);
  if (Number.isNaN(parsed.getTime())) return options.fallback || String(value || '--');

  const { fallback: _fallback, ...formatOptions } = options;
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: PHILIPPINES_TIMEZONE,
    ...formatOptions
  });

  return `${formatter.format(parsed)} ${getTimezoneLabel(parsed)}`;
}
