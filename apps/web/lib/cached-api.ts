import { cache } from "react";
import {
  getProject as getProjectAction,
  getProjects as getProjectsAction,
  getGitHubStatus as getGitHubStatusAction,
  getGitHubRepos as getGitHubReposAction,
  getGitHubOwners as getGitHubOwnersAction,
} from "@/app/actions/api";

/**
 * Cached version of getProject - prevents duplicate fetches
 * within a single request lifecycle.
 *
 * Example: If layout and page both call getProject(1), only one API call is made.
 */
export const getProject = cache(async (id: number) => {
  return await getProjectAction(id);
});

/**
 * Cached version of getProjects - prevents duplicate fetches
 * within a single request lifecycle.
 */
export const getProjects = cache(async () => {
  return await getProjectsAction();
});

/**
 * Cached version of getGitHubStatus - prevents duplicate fetches
 * within a single request lifecycle.
 */
export const getGitHubStatus = cache(async () => {
  return await getGitHubStatusAction();
});

/**
 * Cached version of getGitHubRepos
 */
export const getGitHubRepos = cache(async (options?: {
  page?: number;
  per_page?: number;
  search?: string;
  owner?: string;
}) => {
  return await getGitHubReposAction(options);
});

/**
 * Cached version of getGitHubOwners
 */
export const getGitHubOwners = cache(async () => {
  return await getGitHubOwnersAction();
});
