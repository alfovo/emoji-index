#!/usr/bin/env node
var mustacheExpress = require('mustache-express')
const express = require('express')
const path = require('path')
const app = express()
const { tallyForAllChannels } = require('./src/getUserEmoji')

require('dotenv').config()
const port = process.env.PORT || 3000
const token = process.env.TOKEN
const ignored_emojis = process.env.IGNORED_EMOJIS.split(' ') || []
const message_limit = process.env.MESSAGE_LIMIT || 1000

app.engine('html', mustacheExpress())
app.set('views', path.join(__dirname, 'src/views'))
app.set('view engine', 'html')
app.use(express.static(path.join(__dirname, 'src/public')))

app.get('/', async (req, res) => {
  const mojis = await tallyForAllChannels(token, ignored_emojis, message_limit)
  res.render('index', {
    header: 'Emoji Index',
    favorites: mojis.favoriteEmojis,
    items: mojis.userNameEmojiMaps
  })
})
app.listen(port, () => console.log(`EmojiIndex listening on port ${port}...`))
