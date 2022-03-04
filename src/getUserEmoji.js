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

function isValidUser(user) {
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
  return (
    user.deleted == false &&
    user.is_bot == false &&
    !ignored_users.includes(user['profile']['real_name'])
  )
}

// converts array of user data from the slack API to
// { userId1: 'Alex', userId2: 'German'}
function getUserIdNameMap(userInfoArray) {
  return userInfoArray.reduce(function(users, user) {
    if (isValidUser(user)) {
      users.set(user.id, user['profile']['real_name'])
    }
    return users
  }, new Map())
}

// removes skin tone indicators and non-emoji strings that match the emojiRegex.
function isValidEmoji(emoji) {
  const excluded = [
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

  return (
    !excluded.includes(emoji) && isNaN(emoji) && !emoji.includes('skin-tone')
  )
}

// converts a string containing emojis to an array of emoji names.
function getEmojisFromString(regex, text) {
  const emojis = text.match(regex) || []
  return emojis.reduce(function(validEmojis, emoji) {
    let strippedEmoji = emoji.replace(/:/gi, '')
    if (isValidEmoji(strippedEmoji)) {
      validEmojis.push(strippedEmoji)
    }
    return validEmojis
  }, [])
}

// converts array of user message data from the slack API to
// { userId1: ['cat'], userId2: ['slightly_smiling_face', 'dance', 'slightly_smiling_face'] }
function getEmojisPerUserId(messages) {
  return messages.reduce(function(userIdEmojis, message) {
    const emojis = getEmojisFromString(emojiRegex, message.text)
    // If you've never used an emoji you will not be included in userIds to emojis mapping
    if (emojis && emojis.length > 0) {
      if (userIdEmojis[message.user]) {
        userIdEmojis[message.user] = [...userIdEmojis[message.user], ...emojis]
      } else if (message.user) {
        userIdEmojis[message.user] = emojis
      }
    }
    return userIdEmojis
  }, {})
}

// Converts [':robot_face:', ':dog:', ':robot_face:', ':bento:', ':dog:']
// to { ':robot_face:': 2, ':bento:': 1, ':dog:': 2 }
// Also chose to use a Map instead of Object in case there is any ever 'prototype' emoji
function getTallyfromList(emojis) {
  return emojis.reduce(function(tally, emoji) {
    if (tally.get(emoji)) {
      let frequency = tally.get(emoji)
      tally.set(emoji, frequency + 1)
    } else {
      tally.set(emoji, 1)
    }
    return tally
  }, new Map())
}

// Converts [':robot_face:', ':dog:', ':robot_face:', ':bento:', ':dog:']
// to [{ value: '1', mojis: ['🍱']}, { value: '2', mojis: ['🐶', '🤖'] }]
function formatEmojiData(emojis) {
  const emojiCounts = getTallyfromList(emojis)

  let mergedTally = []
  for (const [emojiName, value] of emojiCounts) {
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

// This function is overloaded for the sake of only iterating through the
// userIdEmojisMap once. It replaces userId with the user's name, formats the
// emoji list into a tally and returns a second object with each user's favorite emoji
function formatUserEmojiData(userIdNameMap, userIdEmojis) {
  const userNameEmojisArray = []
  const favoriteEmojis = []

  for (let [userId, emojis] of Object.entries(userIdEmojis)) {
    if (userIdNameMap.get(userId)) {
      const formattedEmojis = formatEmojiData(emojis)
      userNameEmojisArray.push({
        name: userIdNameMap.get(userId),
        emojis: formattedEmojis
      })
      favoriteEmojis.push(
        Object.assign({
          moji: formattedEmojis[formattedEmojis.length - 1].mojis,
          value: formattedEmojis[formattedEmojis.length - 1].value,
          name: userIdNameMap.get(userId)
        })
      )
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

  const userIdEmojis = getEmojisPerUserId(allMessages)

  return formatUserEmojiData(userIdNameMap, userIdEmojis)
}

module.exports = {
  emojiRegex: emojiRegex,
  getTallyfromList: getTallyfromList,
  formatEmojiData: formatEmojiData,
  formatUserEmojiData: formatUserEmojiData,
  getEmojisFromString: getEmojisFromString,
  getEmojisPerUserId: getEmojisPerUserId,
  tallyForAllChannels: tallyForAllChannels,
  getUserIdNameMap: getUserIdNameMap
}
