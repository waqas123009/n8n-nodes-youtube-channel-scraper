import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { chromium } from 'playwright';

type TikTokUser = {
  name: string;
  url: string;
  avatar: string;
  followers: string;
  description: string;
  emails: string[];
  keyword: string;
};

export class TiktokUserScraper implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'TikTok User Scraper',
    name: 'tiktokUserScraper',
    group: ['transform'],
    version: 1,
    description: 'Scrapes TikTok user details using Playwright',
    defaults: {
      name: 'TikTok User Scraper',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Keywords',
        name: 'keywords',
        type: 'string',
        default: 'Crypto',
        description: 'Comma-separated keywords to search for TikTok users',
      },
      {
        displayName: 'Minimum Followers',
        name: 'minFollowers',
        type: 'number',
        default: 50000,
        description: 'Filter users by minimum follower count (e.g., 50000 for 50K)',
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
    const minFollowers = (this.getNodeParameter('minFollowers', 0) as number) || 50000;
    const keywords = keywordInput.split(',').map((k) => k.trim()).filter(Boolean);

    const headless = this.getNodeParameter('headless', 0) as boolean;
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      locale: 'en-US',
    });
    const page = await context.newPage();

    for (const keyword of keywords) {
      await page.goto(
        `https://www.tiktok.com/search/user?q=${encodeURIComponent(keyword)}`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForTimeout(10000);

      // Extract user cards from search results
      const users: TikTokUser[] = await page.evaluate((kw) => {
        const nodes = document.querySelectorAll('[data-e2e="search-user-card"]');
        return Array.from(nodes).map((node) => {
          const el = node as HTMLElement;
          const nameEl = el.querySelector('[data-e2e="search-user-username"]') as HTMLElement | null;
          const linkEl = el.querySelector('a') as HTMLAnchorElement | null;
          const imgEl = el.querySelector('img') as HTMLImageElement | null;
          const followersEl = el.querySelector('[data-e2e="search-user-subtitle"]') as HTMLElement | null;
          const descEl = el.querySelector('[data-e2e="search-user-bio"]') as HTMLElement | null;

          const description = descEl?.textContent?.trim() || '';
          const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = Array.from(new Set((description.match(emailPattern) || [])));

          return {
            name: nameEl?.textContent?.trim() || 'No name',
            url: linkEl?.href || '',
            avatar: imgEl?.src || '',
            followers: followersEl?.textContent?.trim() || '',
            description,
            emails: emails.length ? emails.map(e => e.toLowerCase()) : ['No email found'],
            keyword: kw,
          };
        });
      }, keyword);

      // Filter by min followers
      const filtered = users.filter((u) => {
        const text = (u.followers || '').toUpperCase();
        try {
          let count = 0;
          if (text.endsWith('K')) count = parseFloat(text.replace('K', '')) * 1000;
          else if (text.endsWith('M')) count = parseFloat(text.replace('M', '')) * 1_000_000;
          else count = parseFloat(text.replace(/,/g, ''));
          return Number.isFinite(count) && count >= minFollowers;
        } catch {
          return false;
        }
      });

      for (const u of filtered) {
        returnData.push({ json: u });
      }
    }

    await page.close();
    await browser.close();

    return [returnData];
  }
}