// src/webhook.js
const express = require('express');
const line = require('@line/bot-sdk');
const { LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET } = require('./config');
const { handleImageMessage } = require('./handlers/image');
const { handleTextMessage } = require('./handlers/text');
const { handlePostback } = require('./handlers/postback');

const router = express.Router();

const lineMiddlewareConfig = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

router.post('/', line.middleware(lineMiddlewareConfig), (req, res) => {
  res.status(200).end();
  const events = req.body.events || [];
  events.forEach(event => {
    handleEvent(event).catch(err =>
      console.error('Unhandled event error:', err)
    );
  });
});

async function handleEvent(event) {
  if (event.type === 'message' && event.message?.type === 'image') {
    return handleImageMessage(event);
  }
  if (event.type === 'message' && event.message?.type === 'text') {
    return handleTextMessage(event);
  }
  if (event.type === 'postback') {
    return handlePostback(event);
  }
}

module.exports = router;
