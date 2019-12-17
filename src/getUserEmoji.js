#!/usr/bin/env node
var request = require('request-promise-native')
var emoji = require('node-emoji')

const mainUrl = 'https://slack.com/api/'
const conversationUrl = mainUrl + 'conversations.history'
const usersUrl = mainUrl + 'users.list'
const channelsUrl = mainUrl + 'channels.list'
const ignored_users = [
  'Slackbot',
  'On call Onboarding',
  'Zoom',
  'Google Calendar',
  'Pivotal Tracker',
  'atomist',
  'Life Bot',
  'Protocol Droid',
  'R2 D2',
  'GitHub',
  'Begin',
  'Google Drive',
  'Stack Overflow for Teams',
  'Toast'
]
let favoriteEmojis = []

async function allConversationLookup(url, token, channel) {
  const response = await request({
    uri: url,
    method: 'GET',
    json: true,
    qs: { token: token, channel: channel, limit: 1000 },
    simple: false,
    resolveWithFullResponse: true
  })
  return response.body.messages
}

async function allUsersLookup(url, token) {
  const response = await request({
    uri: url,
    method: 'GET',
    json: true,
    qs: { token: token },
    simple: false,
    resolveWithFullResponse: true
  })
  return response.body.members
}

async function allChannelsLookup(url, token) {
  const response = await request({
    uri: url,
    method: 'GET',
    json: true,
    qs: { token: token },
    simple: false,
    resolveWithFullResponse: true
  })
  return response.body.channels
}

function getUserIdNameMap(userInfo) {
  const usersMap = {}
  if (userInfo && userInfo.length > 0) {
    for (var user of userInfo) {
      if (
        user.deleted !== true &&
        !ignored_users.includes(user.profile.real_name)
      ) {
        usersMap[user.id] = user.profile.real_name
      }
    }
  }
  return usersMap
}

function listToTally(array) {
  let countObj = {}
  if (array && array.length > 0) {
    for (var item of array) {
      if (countObj[item]) {
        countObj[item]++
      } else {
        countObj[item] = 1
      }
    }
  }
  return countObj
}

function mergeTallies(oldTally, newTally) {
  let mergedTally = { ...oldTally }
  if (newTally && newTally !== null) {
    for (let emojiName in newTally) {
      if (oldTally[emojiName]) {
        mergedTally[emojiName] = oldTally[emojiName] + newTally[emojiName]
      } else {
        mergedTally[emojiName] = newTally[emojiName]
      }
    }
  }
  return mergedTally
}

function getEmojis(regex, text) {
  let excluded = [
    'us-east-1',
    'aws',
    'hcc',
    '2em',
    'chs',
    '4di4354',
    '6di',
    'hbrreprint',
    'hc',
    'abt',
    'li'
  ]
  let emojis = text.match(regex)
  if (emojis === null) {
    return null
  }
  let cleanedEmojis = []
  emojis.forEach(emoji => {
    let strippedEmoji = emoji.replace(/:/gi, '')
    // remove skin tones, numbers and aws crap
    if (
      !excluded.includes(strippedEmoji) &&
      isNaN(strippedEmoji) &&
      !strippedEmoji.includes('skin-tone')
    ) {
      cleanedEmojis.push(strippedEmoji)
    }
  })
  return cleanedEmojis
}

function tallyEmojis(messages) {
  let userIdEmojiMap = {}
  if (messages && messages.length > 0) {
    let emojiRegex = /\:([a-z1-9-_]*?)\:/g
    for (var message of messages) {
      let emojis = getEmojis(emojiRegex, message.text)
      if (emojis && emojis.length > 0) {
        let emojiCount = listToTally(emojis)
        if (userIdEmojiMap[message.user]) {
          userIdEmojiMap[message.user] = mergeTallies(
            userIdEmojiMap[message.user],
            emojiCount
          )
        } else if (message.user) {
          userIdEmojiMap[message.user] = emojiCount
        }
      }
    }
  }
  return userIdEmojiMap
}

async function tallyForAllChannels(token) {
  const allChannels = await allChannelsLookup(channelsUrl, token)
  let userIdEmojiMap = {}
  for (var channel of allChannels) {
    if (channel.is_member === true) {
      let messages = await allConversationLookup(
        conversationUrl,
        token,
        channel.id
      )
      let channelEmojisTally = tallyEmojis(messages)
      if (Object.keys(channelEmojisTally).length > 0) {
        for (let userId in channelEmojisTally) {
          if (userIdEmojiMap[userId]) {
            userIdEmojiMap[userId] = mergeTallies(
              userIdEmojiMap[userId],
              channelEmojisTally[userId]
            )
          } else {
            userIdEmojiMap[userId] = channelEmojisTally[userId]
          }
        }
      }
    }
  }
  return replaceNamesEmojis(userIdEmojiMap, token)
}

async function replaceNamesEmojis(userIdEmojiMap, token) {
  let nameEmojiMap = []
  const userInfo = await allUsersLookup(usersUrl, token)
  const users = getUserIdNameMap(userInfo)
  for (let [userId, emojiMap] of Object.entries(userIdEmojiMap)) {
    if (users[userId] && Object.keys(emojiMap).length > 0) {
      let newValues = []
      let favoriteValue = {
        value: 1
      }
      for (let emojiName in emojiMap) {
        let newValue = {}
        if (emoji.get([emojiName])) {
          newValue = {
            moji: emoji.get([emojiName]),
            value: emojiMap[emojiName]
          }
        } else {
          newValue = {
            moji: emojiName,
            value: emojiMap[emojiName]
          }
        }
        if (newValue.value > favoriteValue.value) {
          favoriteValue = {
            ...newValue,
            favorite: true
          }
        }
        newValues.push(newValue)
      }
      if (favoriteValue.value > 1) {
        newValues.push(favoriteValue)
        favoriteEmojis.push({ ...favoriteValue, name: users[userId] })
      }
      nameEmojiMap.push({ name: users[userId], emojis: newValues })
    }
  }
  return nameEmojiMap
}

module.exports = {
  listToTally: listToTally,
  mergeTallies: mergeTallies,
  getEmojis: getEmojis,
  tallyForAllChannels: tallyForAllChannels,
  favoriteEmojis: favoriteEmojis
}
