import { decode } from 'html-entities';

export const stripHtmlTags = (html: string = ''): string => {
  const decoded = decode(html); // decode &lt;, &gt;, &nbsp;, etc.
  const withoutTags = decoded.replace(/<[^>]*>/g, ' '); // remove HTML tags
  return withoutTags.replace(/\s+/g, ' ').trim(); // normalize whitespace
};
