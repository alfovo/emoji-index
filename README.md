# The Emoji Index

Tallies emojis for all users within the last 1000 messages for all slack channels within a slack team. The emoji index is swiftly becoming the most important metric by which to measure your team's productivity. Buy now!

## To Run:

First, create a token for your slack workplace, such as "xxksjdfhkauhr-secret-ksdfjoij". Then run:

```
TOKEN='xxksjdfhkauhr-secret-ksdfjoij' nodemon index.js
```

Alternatively, you can set variables in a `.env` file. The variables you can set are:

- `TOKEN`: the token for your slack workplace
- `PORT`: the port you would like the express application to run on
- `IGNORED_EMOJIS`: emojis you would like to ignore separated by a space. For example: `'simple_smile slightly_smiling_face smile'`
- `MESSAGE_LIMIT`: the number of messages per channel you'd like to tally emojis from. The upper limit is 1,000 and the default is 100.
