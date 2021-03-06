#!/usr/bin/env node
const request = require('request-promise-native')
const emoji = require('node-emoji')

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

async function allConversationLookup(url, token, channel, message_limit) {
  const response = await request({
    uri: url,
    method: 'GET',
    json: true,
    qs: { token: token, channel: channel, limit: message_limit },
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

function listToTally(emojiList) {
  let tally = {}
  if (emojiList && emojiList.length > 0) {
    for (var item of emojiList) {
      if (tally[item]) {
        tally[item]++
      } else {
        tally[item] = 1
      }
    }
  }
  return tally
}

function mergeTallies(tallies) {
  let mergedTally = {}
  for (let [emojiName, count] of Object.entries(tallies)) {
    let moji = emoji.get([emojiName])
    if (mergedTally[count]) {
      mergedTally[count].push(moji)
    } else {
      mergedTally[count] = [moji]
    }
  }
  return mergedTally
}

function convertToArrayFormat(mergedTally) {
  let mojiCountsArray = []
  for (let [count, mojis] of Object.entries(mergedTally)) {
    mojiCountsArray.push({ moji: mojis, value: count })
  }
  return mojiCountsArray
}

function formatMojiData(emojiList) {
  const emojiCounts = listToTally(emojiList)
  const mergedEmojiCounts = mergeTallies(emojiCounts)
  return convertToArrayFormat(mergedEmojiCounts)
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
    'li',
    'so',
    'or'
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

function getEmojiList(messages) {
  let userIdEmojiMap = {}
  if (messages && messages.length > 0) {
    let emojiRegex = /\:([a-z1-9-_]*?)\:/g
    for (var message of messages) {
      let emojis = getEmojis(emojiRegex, message.text)
      if (emojis && emojis.length > 0) {
        if (userIdEmojiMap[message.user]) {
          userIdEmojiMap[message.user] = [
            ...userIdEmojiMap[message.user],
            ...emojis
          ]
        } else if (message.user) {
          userIdEmojiMap[message.user] = emojis
        }
      }
    }
  }
  return userIdEmojiMap
}

function getUserIdNameMap(userInfo) {
  const usersMap = {}
  if (userInfo && userInfo.length > 0) {
    for (var user of userInfo) {
      if (user.deleted !== true && !ignored_users.includes(user.real_name)) {
        usersMap[user.id] = user.real_name
      }
    }
  }
  return usersMap
}

async function replaceNamesEmojis(token, userIdEmojiList) {
  let userNameEmojiMaps = []
  let formattedMojis = []
  let favoriteEmojis = []
  const allUsers = await allUsersLookup(usersUrl, token)
  const users = await getUserIdNameMap(allUsers)
  for (let [userId, emojiList] of Object.entries(userIdEmojiList)) {
    if (users[userId] && Object.keys(emojiList).length > 0) {
      formattedMojis = formatMojiData(emojiList)
      userNameEmojiMaps.push({
        name: users[userId],
        emojis: formattedMojis
      })
      favoriteEmojis.push({
        moji: formattedMojis[formattedMojis.length - 1].moji,
        value: formattedMojis[formattedMojis.length - 1].value,
        name: users[userId]
      })
    }
  }
  return {
    userNameEmojiMaps: userNameEmojiMaps,
    favoriteEmojis: favoriteEmojis
  }
}

async function tallyForAllChannels(token, message_limit) {
  const allChannels = await allChannelsLookup(channelsUrl, token)
  let userIdEmojiList = {}
  for (var channel of allChannels) {
    if (channel.is_member === true) {
      let messages = await allConversationLookup(
        conversationUrl,
        token,
        channel.id,
        message_limit
      )
      let channelUserEmojisMap = getEmojiList(messages)
      if (Object.keys(channelUserEmojisMap).length > 0) {
        for (let userId in channelUserEmojisMap) {
          if (userIdEmojiList[userId]) {
            userIdEmojiList[userId] = [
              ...userIdEmojiList[userId],
              ...channelUserEmojisMap[userId]
            ]
          } else {
            userIdEmojiList[userId] = channelUserEmojisMap[userId]
          }
        }
      }
    }
  }

  return replaceNamesEmojis(token, userIdEmojiList)
}

module.exports = {
  listToTally: listToTally,
  mergeTallies: mergeTallies,
  getEmojis: getEmojis,
  getEmojiList: getEmojiList,
  tallyForAllChannels: tallyForAllChannels,
  getUserIdNameMap: getUserIdNameMap
}
