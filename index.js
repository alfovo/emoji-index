#!/usr/bin/env node
var mustacheExpress = require('mustache-express')
const express = require('express')
const path = require('path')
const app = express()
const port = 3000 || process.env.PORT
const token = process.env.TOKEN
const { tallyForAllChannels, favoriteEmojis } = require('./src/getUserEmoji')

app.engine('html', mustacheExpress())
app.set('views', path.join(__dirname, 'src/views'))
app.set('view engine', 'html')
app.use(express.static(path.join(__dirname, 'src/public')))

app.get('/', async (req, res) => {
  const mojis = await tallyForAllChannels(token)

  res.render('index', {
    header: 'Emoji Index',
    favorites: favoriteEmojis,
    items: mojis
  })
})
app.listen(port, () => console.log(`EmojiIndex listening on port ${port}!`))
