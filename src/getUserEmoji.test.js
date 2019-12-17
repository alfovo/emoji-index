import { listToTally, mergeTallies, getEmojis } from './getUserEmoji.js'

describe('the emojiCounter', () => {
  it('turns a list of emojis to a tally of emojis and their count', () => {
    let emojiRegex = /\:(.*?)\:/g
    let text =
      '*thanks guys! and kudos as awlays to :woman-facepalming::skin-tone-2: :slightly_smiling_face: for :smile: working her magic* :slightly_smiling_face: '
    let emojis = text.match(emojiRegex)
    let tally = listToTally(emojis)

    expect(tally).toEqual({
      ':skin-tone-2:': 1,
      ':slightly_smiling_face:': 2,
      ':smile:': 1,
      ':woman-facepalming:': 1
    })
  })
  it('adds two tallys to create a new tally', () => {
    let tally1 = {
      ':slightly_smiling_face:': 2,
      ':smile:': 1
    }

    let tally2 = {
      ':smile:': 3,
      ':sad_face': 2
    }

    let expectedTally = {
      ':slightly_smiling_face:': 2,
      ':smile:': 4,
      ':sad_face': 2
    }
    expect(mergeTallies(tally1, tally2)).toEqual(expectedTally)
  })
  it('gets emojis', () => {
    let emojiRegex = /\:([a-z1-9-_]*?)\:/g
    let text = "already done :sunglasses: she's very on top of it!"
    expect(getEmojis(emojiRegex, text)).toEqual(['sunglasses'])
  })
})
