const request = require('request-promise-native')
const emoji = require('node-emoji')

const mainUrl = 'https://slack.com/api/'

// Fetches a conversation's history of messages and events.
const conversationUrl = mainUrl + 'conversations.history'

// This method returns a list of all users in the workspace, including
// deleted/deactivated users.
const usersUrl = mainUrl + 'users.list'

// Fetches a list of slack channels.
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
  return emojiList.reduce(function(tally, emoji) {
    if (tally[emoji]) {
      tally[emoji]++
    } else {
      tally[emoji] = 1
    }
    return tally
  }, {})
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

function getUserIdEmojiListMap(messages) {
  const emojiRegex = /\:([a-z1-9-_]*?)\:/g
  const userIdEmojiListMap = {}
  for (var message of messages) {
    let emojis = getEmojis(emojiRegex, message.text)
    if (emojis && emojis.length > 0) {
      if (userIdEmojiListMap[message.user]) {
        userIdEmojiListMap[message.user] = [
          ...userIdEmojiListMap[message.user],
          ...emojis
        ]
      } else if (message.user) {
        userIdEmojiListMap[message.user] = emojis
      }
    }
  }

  return userIdEmojiListMap
}

function getUserIdNameMap(userInfoArray) {
  return userInfoArray.reduce(function(users, user) {
    if (
      user.deleted == false &&
      user.is_bot == false &&
      !ignored_users.includes(user['profile']['real_name'])
    ) {
      users[user.id] = user['profile']['real_name']
    }
    return users
  }, {})
}

async function replaceIdsWithNamesAndTallyEmojis(
  userInfoArray,
  userIdEmojiTallyMap
) {
  const userNameEmojisArray = []
  const formattedMojis = []
  const favoriteEmojis = []
  const users = getUserIdNameMap(userInfoArray)
  for (let [userId, emojiList] of Object.entries(userIdEmojiTallyMap)) {
    if (users[userId] && Object.keys(emojiList).length > 0) {
      formattedMojis = formatMojiData(emojiList)
      userNameEmojisArray.push({
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
    userNameEmojisArray,
    favoriteEmojis
  }
}

async function tallyForAllChannels(token, message_limit) {
  const { userInfoArray } = await apiRequest(usersUrl, { token })
  if (!userInfoArray) {
    return new Error(
      'Unable to find any users in this slack workspace. Please verify that you are using the correct API token.'
    )
  }

  const { channels } = await apiRequest(channelsUrl, {
    token
  })
  if (!channels) {
    return new Error(
      'Unable to find any channels in this slack workspace. Please verify that you are using the correct API token.'
    )
  }
  const userIdEmojiListAllChannelsMap = {}
  for (let channel of channels) {
    if (channel.is_member !== true) {
      console.log(`User is not a member of ${channel}, skipping messages.`)
      continue
    }
    const { messages } = await apiRequest(conversationUrl, {
      token,
      channel: channel.id,
      limit: message_limit
    })
    if (!messages) {
      console.log(`Unable to find any messages in ${channel}. `)
      continue
    }
    const userIdEmojiListMap = getUserIdEmojiListMap(messages)
    for (let userId in userIdEmojiListMap) {
      if (userIdEmojiListAllChannelsMap[userId]) {
        userIdEmojiListAllChannelsMap[userId] = [
          ...userIdEmojiListAllChannelsMap[userId],
          ...userIdEmojiListMap[userId]
        ]
      } else {
        userIdEmojiListAllChannelsMap[userId] = userIdEmojiListMap[userId]
      }
    }
  }

  return replaceIdsWithNamesAndTallyEmojis(userInfoArray, userIdEmojiTallyMap)
}

module.exports = {
  listToTally: listToTally,
  mergeTallies: mergeTallies,
  getEmojis: getEmojis,
  getUserIdEmojiListMap: getUserIdEmojiListMap,
  tallyForAllChannels: tallyForAllChannels,
  getUserIdNameMap: getUserIdNameMap
}
