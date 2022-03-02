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

const emojiRegex = /:([a-z1-9-_]*?):/g

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
function formatEmojiData(emojiList) {
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
// If you've never used an emoji you will not be included in userIds to emojis mapping
function getEmojiListPerUserId(messages) {
  return messages.reduce(function(userIdEmojiListMap, message) {
    let emojis = getEmojiListFromString(emojiRegex, message.text)
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

    return userIdEmojiListMap
  }, {})
}

// This function is very overloaded for the sake of only iterating through the
// userIdEmojiListMap once. It replaces userId with the user's name, formats the
// emoji list into a tally and returns a second object with each user's favorite emoji
function formatUserEmojiData(userIdNameMap, userIdEmojiListMap) {
  const userNameEmojisArray = []
  const favoriteEmojis = []

  for (let [userId, emojis] of Object.entries(userIdEmojiListMap)) {
    if (userIdNameMap[userId]) {
      const formattedEmojis = formatEmojiData(emojis)
      userNameEmojisArray.push({
        name: userIdNameMap[userId],
        emojis: formattedEmojis
      })
      favoriteEmojis.push({
        moji: formattedEmojis[formattedEmojis.length - 1].mojis,
        value: formattedEmojis[formattedEmojis.length - 1].value,
        name: userIdNameMap[userId]
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
  const userIdNameMap = getUserIdNameMap(userInfoArray)

  // allMessages might be an overwhelming number of messages.
  const allMessages = []
  const { channels } = await apiRequest(channelsUrl, {
    token
  })
  if (!channels) {
    return new Error(
      'Unable to find any channels in this slack workspace. Please verify that you are using the correct API token.'
    )
  }
  for (let channel of channels) {
    if (channel.is_member !== true) {
      console.log(`User is not a member of ${channel}, skipping messages.`)
      continue
    }
    const { channelMessages } = await apiRequest(conversationUrl, {
      token,
      channel: channel.id,
      limit: message_limit
    })
    if (!channelMessages) {
      console.log(`Unable to find any messages in ${channel}. `)
      continue
    }
    allMessages.concat(channelMessages)
  }

  const userIdEmojiListMap = getEmojiListPerUserId(allMessages)

  return formatUserEmojiData(userIdNameMap, userIdEmojiListMap)
}

module.exports = {
  emojiRegex: emojiRegex,
  listToTally: listToTally,
  formatEmojiData: formatEmojiData,
  formatUserEmojiData: formatUserEmojiData,
  getEmojiListFromString: getEmojiListFromString,
  getEmojiListPerUserId: getEmojiListPerUserId,
  tallyForAllChannels: tallyForAllChannels,
  getUserIdNameMap: getUserIdNameMap
}
