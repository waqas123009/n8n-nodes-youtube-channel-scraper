## 📌 Description
This PR adds the **YouTube Channel Scraper** community node.

The node allows users to:
- Fetch YouTube channel metadata (title, description, URL, subscriber count, etc.)
- Optionally extract emails from channel descriptions
- Configure region and language options
- Toggle headless mode for debugging

It is built with **Playwright** for reliable scraping and follows n8n’s linting and naming conventions.

---

## 🔍 Testing
- [x] Linting passes with `npm run lint`
- [x] Node builds successfully with `npm run build`
- [x] Tested locally in n8n editor
- [x] Verified output structure matches expected JSON format

Example output:
```json
{
  "channelName": "Example Channel",
  "channelUrl": "https://www.youtube.com/@example",
  "description": "This is a demo channel",
  "subscribers": "120K",
  "emails": ["contact@example.com"]
}
✅ Checklist
[x] Package name follows n8n-nodes-* convention

[x] README.md includes installation and usage instructions

[x] Boolean parameter descriptions start with “Whether …”

[x] License file included (MIT)

[x] Published to npm: n8n-nodes-youtube-channel-scraper

📎 Links
npm package: n8n-nodes-youtube-channel-scraper

GitHub repo: https://github.com/waqas123009/n8n-nodes-youtube-channel-scraper

Code

---

### Why this works
- **Description** → clear overview of what your node does.  
- **Testing** → shows you’ve validated it locally.  
- **Checklist** → matches n8n’s review criteria.  
- **Links** → makes it easy for maintainers to verify.  
