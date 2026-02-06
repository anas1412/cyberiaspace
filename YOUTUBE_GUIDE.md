# YouTube Link Validation & Metadata (Frontend / React)

This document explains how to validate a YouTube video link and fetch basic metadata
(title + uploader) **from the browser**, without an API key.


## What This Solves
- Check if a YouTube video exists
- Fetch video title
- Fetch uploader (channel name)
- Works in React / browser environments
- No API key, no CORS issues


## Recommended Method: YouTube oEmbed

YouTube provides a public oEmbed endpoint that returns metadata
for valid videos.

### Endpoint

```
[https://www.youtube.com/oembed?url=VIDEO_URL&format=json](https://www.youtube.com/oembed?url=VIDEO_URL&format=json)
```

### Behavior
- **200 OK** → video exists, metadata returned
- **404** → invalid, deleted, or private video



## Example (Video URL)

```
[https://www.youtube.com/watch?v=5iksTXMTh-8](https://www.youtube.com/watch?v=5iksTXMTh-8)
```

### Fetch URL

```
[https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=5iksTXMTh-8&format=json](https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=5iksTXMTh-8&format=json)
```


## Example Response

```json
{
  "title": "Video Title",
  "author_name": "Channel Name",
  "author_url": "https://www.youtube.com/@ChannelName",
  "thumbnail_url": "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg",
  "provider_name": "YouTube"
}
````

### Useful Fields

* `title` → Video title
* `author_name` → Uploader / channel name
* `author_url` → Channel URL
* `thumbnail_url` → Preview image



## React Usage Example

```jsx
async function fetchYouTubeMeta(videoUrl) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
  );

  if (!res.ok) throw new Error("Video unavailable");

  return res.json();
}
```



## Error Handling

* Network error or non-200 response should be treated as:

  * Invalid
  * Deleted
  * Private
  * Region restricted



## What This Does NOT Provide

* View count
* Likes
* Description
* Comments
* Video duration

For advanced data, a backend service or the YouTube Data API is required.