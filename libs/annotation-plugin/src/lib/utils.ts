import parseMilliseconds from 'parse-ms';

export function formatMS(ms: number) {
  const { days, seconds, minutes, hours } = parseMilliseconds(ms);

  if (days === 0 && hours === 0 && minutes === 0) return `${seconds}s`;
  else if (days === 0 && hours === 0) return `${minutes}m ${seconds} s`;
  else if (days === 0) return `${hours}h ${minutes}m`;
  else return `${days * 24 + hours}h`;
}
