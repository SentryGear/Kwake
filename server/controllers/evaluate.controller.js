import Evaluate from '../models/evaluate';
import Token, { TYPE_EVALUATE } from '../models/token';
import User from '../models/user';

import cuid from 'cuid';
import { generateRandomToken } from '../util/security';
import _ from 'lodash';
import { sendEvaluateRequest } from '../../emails';
import { getPersonalityType } from '../../utils/disc_helpers';

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
    let savedEvaluate, evaluateToken, tokenUser;
    Token.findOne({ token: req.params.token, type: TYPE_EVALUATE })
      .then(token => {
        if (!token) {
          res.status(403).end();
        } else if (token.dateUsed) {
          res.status(403).end();
        } else {
          evaluateToken = token;
          let evaluate = new Evaluate({
            cuid: cuid(),
            requester: evaluateToken.requester,
            responderEmail: evaluateToken.responderEmail,
            personalityKey: req.body.personalityKey,
            talents: req.body.talents,
            statements: req.body.statements
          });
          return evaluate.save();
        }
      })
      .then((saved) => {
        savedEvaluate = saved;
        if (evaluateToken.token != 'demo_token') {
          evaluateToken.dateUsed = Date.now();
        }
        return evaluateToken.save();
      })
      .then((saved) => {
        return User.findOne({ cuid: evaluateToken.requester })
      })
      .then((requester) => {
        if (requester) {
          tokenUser = requester;
          return Evaluate.count({ requester: requester.cuid })
        } else {
          res.json({ evaluate: savedEvaluate });
        }
      })
      .then((evaluateCount) => {
        res.json({ evaluate: savedEvaluate, isUnlocked: evaluateCount === tokenUser.scoreLimit });
      })
      .catch(err=> {
        res.status(500).send(err);
      });
  }
}

export function createEvaluateRequest(req, res) {
  if (!req.body.emails) {
    res.status(403).end();
  } else {
    User.find({}, 'email cuid').where('email').in(req.body.emails).then((users)=> {
      let emails = req.body.emails.filter(email => email !== req.user.email);
      let tokensObjects = emails.map((email) => {
        let existUser = users.filter(user => user.email === email)[0];
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
          let tokens = savedTokens.ops.map(token => {
            return {
              email: token.responderEmail,
              token: token.token,
              givenName: req.user.givenName,
              familyName: req.user.familyName,
              image: req.user.image,
              profileType: getPersonalityType(req.user),
              gender: req.user.gender
            }
          });
          sendEvaluateRequest(tokens);
          res.json({ tokens });
        }
      });
    });
  }
}
