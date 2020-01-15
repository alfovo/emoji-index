import {
  listToTally,
  mergeTallies,
  getEmojis,
  getEmojiList
} from './getUserEmoji.js'

describe('the emojiCounter', () => {
  it('turns a list of emojis to a tally of emojis and their count', () => {
    const emojiRegex = /\:(.*?)\:/g
    const text =
      '*thanks guys! and kudos as awlays to :woman-facepalming::skin-tone-2: :slightly_smiling_face: for :smile: working her magic* :slightly_smiling_face: '
    const emojis = text.match(emojiRegex)
    const tally = listToTally(emojis)

    expect(tally).toEqual({
      ':skin-tone-2:': 1,
      ':slightly_smiling_face:': 2,
      ':smile:': 1,
      ':woman-facepalming:': 1
    })
  })
  it('combines tallys to create a new tally', () => {
    const tallies = {
      robot_face: 5,
      bento: 1,
      dog: 3,
      stew: 3,
      memo: 1,
      eyes: 1,
      'star-struck': 1,
      wink: 1,
      slightly_smiling_face: 2,
      bow: 1,
      seedling: 1
    }

    const expectedTally = {
      1: [ 'bento', 'memo', 'eyes', 'star-struck', 'wink', 'bow', 'seedling' ],
      2: [ 'slightly_smiling_face' ],
      3: [ 'dog', 'stew' ],
      5: ['robot_face']
    }
    expect(mergeTallies(tallies)).toEqual(expectedTally)
  })

  it('gets emojis', () => {
    const emojiRegex = /\:([a-z1-9-_]*?)\:/g
    const text = "already done :sunglasses: she's very on top of it!"
    expect(getEmojis(emojiRegex, text)).toEqual(['sunglasses'])
  })

  it('lists emojis', () => {
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
      }
    ]
    const expectedResult = {
      UC30ZFAL9: ['cat'],
      UBQPZ57AM: ['slightly_smiling_face', 'dance', 'slightly_smiling_face']
    }
    expect(getEmojiList(messages)).toEqual(expectedResult)
  })

  it('conversts list to tally', () => {
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

    expect(listToTally(list)).toEqual({
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
})
