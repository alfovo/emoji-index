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

async function apiRequest(uri, qs) {
  return (await request({
    uri,
    method: 'GET',
    json: true,
    qs,
    simple: false,
    resolveWithFullResponse: true
  })).body
}

function listToTally(emojiList) {
  let tally = {}
  if (emojiList) {
    for (let item of emojiList) {
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
  return Object.entries(mergedTally).map(([value, mojis]) => ({
    value,
    mojis
  }))
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
  let cleanedEmojis = emojis.map(emoji => emoji.replace(/:/gi, '')).filter(
    strippedEmoji =>
      // remove skin tones, numbers and aws crap
      !excluded.includes(strippedEmoji) &&
      isNaN(strippedEmoji) &&
      !strippedEmoji.includes('skin-tone')
  )
  return cleanedEmojis
}

function getEmojiList(messages) {
  let userIdEmojiMap = {}
  if (messages) {
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
  if (userInfo) {
    for (var user of userInfo) {
      if (user.deleted !== true && !ignored_users.includes(user.real_name)) {
        usersMap[user.id] = user.real_name
      }
    }
  }
  return usersMap
}

async function replaceNamesEmojis(token, userIdEmojiList) {
  const userNameEmojiMaps = []
  const formattedMojis = []
  const favoriteEmojis = []
  const { members } = await apiRequest(usersUrl, { token })
  const users = getUserIdNameMap(members)
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
    userNameEmojiMaps,
    favoriteEmojis
  }
}

async function tallyForAllChannels(token, message_limit) {
  const { channels } = await apiRequest(channelsUrl, {
    token
  })
  const userIdEmojiList = {}
  for (let channel of channels) {
    if (channel.is_member === true) {
      const { messages } = await apiRequest(conversationUrl, {
        token,
        channel: channel.id,
        limit: message_limit
      })
      const channelUserEmojisMap = getEmojiList(messages)
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
