const getUserEmoji = require('./getUserEmoji')

describe('the emojiCounter', () => {
  it('creates a list of emojis from a string, removing skin tone indicators and non-emoji \
  strings that match the emojiRegex', () => {
    const text =
      '*thanks guys! and kudos as awlays to :woman-facepalming::skin-tone-2: :slightly_smiling_face: for :smile: working her magic* :slightly_smiling_face: '
    expect(
      getUserEmoji.getEmojiListFromString(getUserEmoji.emojiRegex, text)
    ).toEqual([
      'woman-facepalming',
      'slightly_smiling_face',
      'smile',
      'slightly_smiling_face'
    ])
  })

  it('returns an empty array if there are no emojis in a string', () => {
    const text = '*thanks guys! and kudos :aws as awlays :skin-tone-2:'
    expect(
      getUserEmoji.getEmojiListFromString(getUserEmoji.emojiRegex, text)
    ).toEqual([])
  })

  it('turns a list of emojis to a tally of emojis and their count', () => {
    const emojiList = [
      'woman-facepalming',
      'slightly_smiling_face',
      'smile',
      'slightly_smiling_face'
    ]

    expect(getUserEmoji.listToTally(emojiList)).toEqual({
      slightly_smiling_face: 2,
      smile: 1,
      'woman-facepalming': 1
    })
  })

  it('converts an emoji list to tally of emojis per the frequency the occur in the \
  original list', () => {
    const list = [
      'mindblown',
      'robot_face',
      'slightly_smiling_face',
      'robot_face',
      'dance',
      'robot_face',
      'slightly_smiling_face',
      'dancing-chicken',
      'slightly_smiling_face',
      'slightly_smiling_face',
      'slightly_smiling_face',
      'slightly_smiling_face',
      'dance',
      'slightly_smiling_face',
      'slightly_smiling_face',
      'slightly_smiling_face',
      'nerd_face',
      'closed_lock_with_key',
      'female_vampire',
      'slightly_smiling_face'
    ]

    expect(getUserEmoji.listToTally(list)).toEqual({
      closed_lock_with_key: 1,
      dance: 2,
      'dancing-chicken': 1,
      female_vampire: 1,
      mindblown: 1,
      nerd_face: 1,
      robot_face: 3,
      slightly_smiling_face: 10
    })
  })

  it('converts a list of emojis to a list of objects containing a list of emojis and \
  the value or frequency that they occur in the original list', () => {
    const emojiList = [
      'robot_face',
      'robot_face',
      'robot_face',
      'robot_face',
      'robot_face',
      'bento',
      'dog',
      'dog',
      'dog',
      'stew',
      'stew',
      'stew',
      'memo',
      'eyes',
      'star-struck',
      'wink',
      'slightly_smiling_face',
      'bow',
      'seedling',
      'slightly_smiling_face'
    ]

    expect(getUserEmoji.formatEmojiData(emojiList)).toEqual([
      { mojis: ['🍱', '📝', '👀', '🤩', '😉', '🙇‍♂️', '🌱'], value: 1 },
      { mojis: ['🙂'], value: 2 },
      { mojis: ['🐶', '🍲'], value: 3 },
      { mojis: ['🤖'], value: 5 }
    ])
  })

  it('gets a list of emojis per user id. If the user does not use any emojis their \
  id will not appear in the result.', () => {
    const messages = [
      {
        client_msg_id: '7c20a448-f9ab-4acb-a231-74de21a98585',
        type: 'message',
        text:
          "I'll add a story to the icebox and consult Jacob tomorrow - :cat: while not great, I don't want to pull too many engineering resources into it",
        user: 'UC30ZFAL9',
        ts: '1537377133.000100',
        team: 'T0440STUL'
      },
      {
        client_msg_id: 'ff940e1d-9a4a-46a4-9154-cc493e1f6ca0',
        type: 'message',
        text:
          'A couple of us got tripped up by it -- should we revisit the design :slightly_smiling_face:?',
        user: 'UBQPZ57AM',
        ts: '1537377080.000100',
        team: 'T0440STUL'
      },
      {
        client_msg_id: 'da3fc3d6-dea5-4835-bdf7-2d6a9bbad4cc',
        type: 'message',
        text:
          'Seems the ideal situation :dance: is to have at least two :slightly_smiling_face: options for every letter.',
        user: 'UBQPZ57AM',
        ts: '1537377014.000100',
        team: 'T0440STUL'
      },
      {
        client_msg_id: 'da3fc3d6-dea5-4835-bdf7-2d6a9bbad4cc',
        type: 'message',
        text: 'Sounds good to me.',
        user: 'UBQPZ57FG',
        ts: '1537377014.000100',
        team: 'T0440STUL'
      }
    ]
    expect(getUserEmoji.getEmojiListPerUserId(messages)).toEqual({
      UC30ZFAL9: ['cat'],
      UBQPZ57AM: ['slightly_smiling_face', 'dance', 'slightly_smiling_face']
    })
  })

  it('converts array of users data from slack into a map of user id to user name', () => {
    // I wish that is_bot was accurate, but alas...
    expect(
      getUserEmoji.getUserIdNameMap([
        {
          id: 'UT16EAU4V',
          name: 'afvolpert',
          deleted: false,
          profile: {
            real_name: 'Alex'
          },
          is_bot: false
        },
        {
          id: 'UT3C47JTY',
          name: 'german.capuano',
          deleted: false,
          profile: {
            real_name: 'German'
          },
          is_bot: false
        },
        {
          id: 'USLACKBOT',
          name: 'slackbot',
          deleted: false,
          profile: {
            real_name: 'Slackbot'
          },
          is_bot: false
        }
      ])
    ).toEqual({
      UT16EAU4V: 'Alex',
      UT3C47JTY: 'German'
    })
  })

  it("replaces userId with the user's name, formats the emoji list into a tally and \
  returns a second object with each user's favorite emoji", () => {
    const userIdNameMap = {
      UT16EAU4V: 'Alex',
      UT3C47JTY: 'German'
    }
    const userIdEmojiListMap = {
      UT16EAU4V: ['cat'],
      UT3C47JTY: ['slightly_smiling_face', 'stew', 'slightly_smiling_face']
    }

    expect(
      getUserEmoji.formatUserEmojiData(userIdNameMap, userIdEmojiListMap)
    ).toEqual({
      favoriteEmojis: [
        {
          moji: ['🐱'],
          name: 'Alex',
          value: 1
        },
        {
          moji: ['🙂'],
          name: 'German',
          value: 2
        }
      ],
      userNameEmojisArray: [
        {
          emojis: [
            {
              mojis: ['🐱'],
              value: 1
            }
          ],
          name: 'Alex'
        },
        {
          emojis: [
            {
              mojis: ['🍲'],
              value: 1
            },
            {
              mojis: ['🙂'],
              value: 2
            }
          ],
          name: 'German'
        }
      ]
    })
  })
})
