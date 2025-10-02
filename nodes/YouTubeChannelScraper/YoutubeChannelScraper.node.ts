import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { chromium } from 'playwright';

type ChannelSummary = {
  name: string;
  url: string;
  avatar: string;
  subscribers: string;
  keyword: string;
};

type ChannelDetails = {
  description: string;
  emails: string[];
  country: string;
};



export class YoutubeChannelScraper implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Youtube Channel Scraper',
    name: 'youtubeChannelScraper',
    group: ['transform'],
    version: 1,
    description: 'Scrapes YouTube channel details using Playwright',
    defaults: {
      name: 'Youtube Channel Scraper',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Keywords',
        name: 'keywords',
        type: 'string',
        default: 'Crypto',
        description: 'Comma-separated keywords to search for channels',
      },
      {
        displayName: 'Minimum Subscribers',
        name: 'minSubscribers',
        type: 'number',
        default: 50000,
        description: 'Filter channels by minimum subscriber count (e.g., 50000 for 50K)',
      },
      {
        displayName: 'Headless Mode',
        name: 'headless',
        type: 'boolean',
        default: true,
        description: 'Whether to run browser in headless mode',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const returnData: INodeExecutionData[] = [];

    const keywordInput = (this.getNodeParameter('keywords', 0) as string) || '';
    const minSubscribers = (this.getNodeParameter('minSubscribers', 0) as number) || 50000;
    const keywords = keywordInput.split(',').map((k) => k.trim()).filter(Boolean);

    const headless = this.getNodeParameter('headless', 0) as boolean;
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      locale: 'en-US', // or 'en-GB', 'fr-FR', etc.
      geolocation: { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
      permissions: ['geolocation'],
    });
    const page = await context.newPage();

    for (const keyword of keywords) {
      await page.goto(
        `https://youtube.com/results?search_query=${encodeURIComponent(keyword)}&sp=EgIQAg%253D%253D`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForTimeout(20000);

      // Scroll until "No more results"
      while (true) {
        await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        await page.waitForTimeout(1500);

        try {
          const endA = await page.locator('xpath=//*[@id="message"]').isVisible();
          const endB = await page.locator('text=No more results').isVisible();
          if (endA || endB) break;
        } catch {
          // If locator not found, continue scrolling
        }
      }

      // Extract channel cards
      const channels: ChannelSummary[] = await page.evaluate((kw) => {
        const nodes = document.querySelectorAll('ytd-channel-renderer');
        return Array.from(nodes).map((node) => {
          const el = node as HTMLElement;
          const nameEl = el.querySelector('#text.style-scope.ytd-channel-name') as HTMLElement | null;
          const linkEl = el.querySelector('a#main-link') as HTMLAnchorElement | null;
          const imgEl = el.querySelector('yt-img-shadow img') as HTMLImageElement | null;
          const subsEl = el.querySelector('#video-count') as HTMLElement | null;

          return {
            name: nameEl?.textContent?.trim() || 'No name',
            url: linkEl?.href || '',
            avatar: imgEl?.src || '',
            subscribers: subsEl?.textContent?.trim() || '',
            keyword: kw,
          };
        });
      }, keyword);

      // Filter by min subscribers
      const filtered = channels.filter((ch) => {
        const subText = (ch.subscribers || '').split(' ')[0];
        if (!subText) return false;
        try {
          let count = 0;
          const t = subText.toUpperCase();
          if (t.endsWith('K')) count = parseFloat(t.replace('K', '')) * 1000;
          else if (t.endsWith('M')) count = parseFloat(t.replace('M', '')) * 1_000_000;
          else count = parseFloat(t.replace(/,/g, ''));
          return Number.isFinite(count) && count >= minSubscribers;
        } catch {
          return false;
        }
      });

      // Visit /about and enrich details
      for (const ch of filtered) {
        if (!ch.url) continue;

        const about = await browser.newPage();
        await about.goto(`${ch.url}/about`, { waitUntil: 'domcontentloaded' });
        await about.waitForURL('**/about', { timeout: 15000 }).catch(() => {});

        const details: ChannelDetails = await about.evaluate(() => {
          const result = {
            description: '',
            emails: [] as string[],
            country: 'Country not specified',
          };

          // Extract description text
          const descEl = document.querySelector('#description-container');
          result.description = descEl?.textContent?.trim() || '';

          // Extract emails from description only
          const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = Array.from(new Set((result.description.match(emailPattern) || [])));
          result.emails = emails.length ? emails.map(e => e.toLowerCase()) : ['No email found'];

          // Try to extract country if visible (optional, may not exist)
          const countryEl = document.querySelector('yt-formatted-string.country-inline, td.country');
          if (countryEl) {
            result.country = countryEl.textContent?.trim() || result.country;
          }

          return result;
        });

        await about.close();

        if (details.emails.length && !details.emails.includes('No email found')) {
          returnData.push({
            json: {
              name: ch.name,
              url: ch.url,
              avatar: ch.avatar,
              subscribers: ch.subscribers,
              description: details.description,
              country: details.country,
              emails: details.emails,
              keyword: ch.keyword,
            },
          });
        }
      }
    }

    await page.close();
    await browser.close();

    return [returnData];
  }
};
