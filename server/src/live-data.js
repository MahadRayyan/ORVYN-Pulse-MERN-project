// Always enforce the source on the server. Old records are preserved, never relabeled.
export const liveAccounts = workspaceId => ({workspaceId,source:'live'});
export const liveReports = workspaceId => ({workspaceId,'filters.source':'live'});
export function reportingFilters(workspaceId,query) {
  if (query.source !== undefined && query.source !== 'live') throw Object.assign(new Error('Only connected-account data is supported.'),{status:400});
  return {workspaceId,source:'live'};
}
