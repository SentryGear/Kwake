import Evaluate from '../models/evaluate';
import Token, { TYPE_EVALUATE } from '../models/token';
import User from '../models/user';

import cuid from 'cuid';
import { generateRandomToken } from '../util/security';
import _ from 'lodash';
import { sendEvaluateRequest } from '../../emails';
import { getPersonalityType } from '../../utils/disc_helpers';
import { getPronoun } from '../../utils/textHelpers';

export function getTokenInfo(req, res) {
  if (!req.params.token) {
    res.status(403).end();
  } else {
    Token.findOne({ token: req.params.token, type: TYPE_EVALUATE })
      .then((token) => {
        if (!token || (token && token.dateUsed)) {
          res.status(403).end();
        } else {
          if (token.token != 'demo_token' && !token.openedAt) {
            token.openedAt = Date.now();
            return token.save();
          } else {
            return token;
          }
        }
      })
      .then((token) => {
        return User.findOne({ cuid: token.requester }, 'givenName familyName image talents dominance influence steadiness conscientiousness gender');
      })
      .then((user) => {
        res.json({ user: _.omit(user.toObject(), '_id') });
      })
      .catch(err => {
        res.status(500).send(err);
      });
  }
}

export function getEvaluates(req, res) {
  let evaluatesProjection = {
    __v: false,
    _id: false,
    responderEmail: false
  };

  let findQuery = {};

  if (req.params.user_cuid) {
    findQuery.requester = req.params.user_cuid;
  }

  Evaluate.find(findQuery, evaluatesProjection).sort('-created_at').exec((err, evaluates) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.json({ evaluates });
    }
  });
}

export function addEvaluate(req, res) {
  if (!req.params.token || !req.body.talents || !req.body.statements || !req.body.personalityKey) {
    res.status(403).end();
  } else {
    Token.findOne({ token: req.params.token, type: TYPE_EVALUATE }).exec((err, token) => {
      if (err) {
        res.status(500).send(err);
      } else if (!token) {
        res.status(403).end();
      } else {
        if (token.dateUsed) {
          res.status(403).end();
        } else {
          let evaluate = new Evaluate({
            cuid: cuid(),
            requester: token.requester,
            responderEmail: token.responderEmail,
            personalityKey: req.body.personalityKey,
            talents: req.body.talents,
            statements: req.body.statements
          });

          let savedEvaluate;

          evaluate.save((err, saved) => {
            if (err) {
              res.status(500).send(err);
            } else {
              savedEvaluate = saved;
              if (token.token != 'demo_token') {
                token.dateUsed = Date.now();
              }
              token.save((err, saved) => {
                if (err) {
                  res.status(500).send(err);
                } else {
                  res.json({ evaluate: savedEvaluate });
                }
              });
            }
          });
        }
      }
    });
  }
}

export function createEvaluateRequest(req, res) {
  if (!req.body.emails) {
    res.status(403).end();
  } else {
    User.find({}, 'email cuid').where('email').in(req.body.emails).then((users)=> {
      let tokensObjects = req.body.emails.map((email) => {
        let existUser = users.filter(user => user.email === email)[0]
        return {
          _id: cuid(),
          requester: req.user.cuid,
          responderEmail: email,
          type: TYPE_EVALUATE,
          token: generateRandomToken(),
          created_at: new Date(),
          responder: existUser && existUser.cuid
        }
      });

      Token.collection.insert(tokensObjects, (err, savedTokens) => {
        if (err) {
          res.status(500).send(err);
        } else {
          let pronoun = getPronoun(req.user.gender);
          let tokens = savedTokens.ops.map(token => {
            return {
              email: token.responderEmail,
              token: token.token,
              givenName: req.user.givenName,
              familyName: req.user.familyName,
              image: req.user.image,
              profileType: getPersonalityType(req.user),
              pronoun
            }
          });
          sendEvaluateRequest(tokens);
          res.json({ tokens });
        }
      });
    });
  }
}
