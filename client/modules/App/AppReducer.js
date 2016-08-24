// Import Actions
import { AUTHENTICATED, NOT_AUTHENTICATED } from './AppActions';
import { SETUP_PROFILE } from '../User/UserActions';

// Initial State
const initialState = {};

const AppReducer = (state = initialState, action) => {
  switch (action.type) {
    case SETUP_PROFILE:
    case AUTHENTICATED:
      return {
        ...state,
        currentUser: action.user,
      };
    case NOT_AUTHENTICATED:
      return initialState;
    default:
      return state;
  }
};

/* Selectors */

// Get showAddPost
export const getShowAddPost = state => state.app.showAddPost;

// Get currentUser
export const getCurrentUser = state => state.app.currentUser;
export const hasProfileCompleted = user => {
  return  user.dominance !== undefined
    && user.influence !== undefined
    && user.steadiness !== undefined
    && user.conscientiousness !== undefined
    && user.talents && user.talents.length === 5
};

// Export Reducer
export default AppReducer;
