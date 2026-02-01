/**
 * Agent instruction prompts for document commands.
 *
 * These prompts are displayed when tbd outputs a document to help
 * the agent understand how to use the content.
 */

/**
 * Header shown when outputting a shortcut document.
 */
export const SHORTCUT_AGENT_HEADER =
  'Agent instructions: You have activated a shortcut with task instructions. If a user has asked you to do a task that requires this work, follow the instructions below carefully.';

/**
 * Header shown when outputting a guidelines document.
 */
export const GUIDELINES_AGENT_HEADER =
  'Agent instructions: You have activated a guidelines document. If a user has asked you to apply these rules, read them carefully and apply them. Use beads to track each step.';
