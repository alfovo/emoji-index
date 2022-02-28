#!/usr/bin/env node
var mustacheExpress = require('mustache-express')
const express = require('express')
const path = require('path')
const app = express()
const { tallyForAllChannels } = require('./src/getUserEmoji')

require('dotenv').config()
const port = process.env.PORT || 3000
const token = process.env.TOKEN
const message_limit = process.env.MESSAGE_LIMIT || 1000

app.engine('html', mustacheExpress())
app.set('views', path.join(__dirname, 'src/views'))
app.set('view engine', 'html')
app.use(express.static(path.join(__dirname, 'src/public')))

app.get('/', (req, res) => {
  tallyForAllChannels(token, message_limit).then(mojis => {
    res.render('index', {
      favorites: mojis.favoriteEmojis,
      items: mojis.userNameEmojiMaps
    })
  })
})
app.listen(port, () => console.log(`EmojiIndex listening on port ${port}...`))
