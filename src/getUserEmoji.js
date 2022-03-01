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

const emojiRegex = /\:([a-z1-9-_]*?)\:/g

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

// converts a string containing emojis to an array of emoji names,
// removing skin tone indicators and non-emoji strings that match the emojiRegex.
function getEmojiListFromString(regex, text) {
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
    return []
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

// Converts [':robot_face:', ':dog:', ':robot_face:', ':bento:', ':dog:']
// to { ':robot_face:': 2, ':bento:': 1, ':dog:': 2 }
function listToTally(emojiList) {
  return emojiList.reduce(function(tally, emojiName) {
    if (tally[emojiName]) {
      tally[emojiName]++
    } else {
      tally[emojiName] = 1
    }
    return tally
  }, {})
}

// Converts [':robot_face:', ':dog:', ':robot_face:', ':bento:', ':dog:']
// to [{ value: '1', mojis: ['🍱']}, { value: '2', mojis: ['🐶', '🤖'] }]
function formatMojiData(emojiList) {
  const emojiCounts = listToTally(emojiList)

  let mergedTally = []
  for (let [emojiName, value] of Object.entries(emojiCounts)) {
    // look up emoji image, the 'moji', by name
    let moji = emoji.get([emojiName])
    // this will create empty indexes in the array that are removed later
    if (mergedTally[value]) {
      mergedTally[value]['mojis'].push(moji)
    } else {
      mergedTally[value] = { value, mojis: [moji] }
    }
  }

  // remove empty indexes
  return mergedTally.filter(item => item)
}

// converts array of user data from the slack API to
// { userId1: 'Alex', userId2: 'German'}
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

// converts array of user message data from the slack API to
// { userId1: ['cat'], userId2: ['slightly_smiling_face', 'dance', 'slightly_smiling_face'] }
function getEmojiListPerUserId(messages) {
  return messages.reduce(function(userIdEmojiListMap, message) {
    let emojis = getEmojiListFromString(emojiRegex, message.text)

    if (emojis) {
      if (userIdEmojiListMap[message.user]) {
        userIdEmojiListMap[message.user] = [
          ...userIdEmojiListMap[message.user],
          ...emojis
        ]
      } else if (message.user) {
        userIdEmojiListMap[message.user] = emojis
      }
    }

    return userIdEmojiListMap
  }, {})
}

function replaceIdsWithNamesAndTallyEmojis(userIdNameMap, userIdEmojiTallyMap) {
  const userNameEmojisArray = []
  const formattedMojis = []
  const favoriteEmojis = []

  for (let [userId, emojiList] of Object.entries(userIdEmojiTallyMap)) {
    if (userIdNameMap[userId] && Object.keys(emojiList).length > 0) {
      formattedMojis = formatMojiData(emojiList)
      userNameEmojisArray.push({
        name: userIdNameMap[userId],
        emojis: formattedMojis
      })
      favoriteEmojis.push({
        moji: formattedMojis[formattedMojis.length - 1].moji,
        value: formattedMojis[formattedMojis.length - 1].value,
        name: userIdNameMap[userId]
      })
    }
  }
  return {
    userNameEmojisArray,
    favoriteEmojis
  }
}

async function getEmojiListPerUserIdAllChannelsMap(channels) {
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
    const userIdEmojiListMap = getEmojiListPerUserId(messages)
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
}

async function tallyForAllChannels(token, message_limit) {
  const { userInfoArray } = await apiRequest(usersUrl, { token })
  if (!userInfoArray) {
    return new Error(
      'Unable to find any users in this slack workspace. Please verify that you are using the correct API token.'
    )
  }
  const userIdNameMap = getUserIdNameMap(userInfoArray)

  const { channels } = await apiRequest(channelsUrl, {
    token
  })
  if (!channels) {
    return new Error(
      'Unable to find any channels in this slack workspace. Please verify that you are using the correct API token.'
    )
  }
  const userIdEmojiListAllChannelsMap = await getEmojiListPerUserIdAllChannelsMap(
    channels
  )

  return replaceIdsWithNamesAndTallyEmojis(
    userIdNameMap,
    userIdEmojiListAllChannelsMap
  )
}

module.exports = {
  emojiRegex: emojiRegex,
  formatMojiData: formatMojiData,
  listToTally: listToTally,
  formatMojiData: formatMojiData,
  getEmojiListFromString: getEmojiListFromString,
  getEmojiListPerUserId: getEmojiListPerUserId,
  tallyForAllChannels: tallyForAllChannels,
  getUserIdNameMap: getUserIdNameMap
}
