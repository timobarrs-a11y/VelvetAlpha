import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RequireProfile } from '../components/auth/RequireProfile';
import { RouteFallback } from '../shared/ui/RouteFallback';
import { ReportActivity } from '../features/objectives/ReportActivity';
import type { ReportedKey } from '../services/dailyObjectivesService';

const App = lazy(() => import('../App'));
const HomeSwitcher = lazy(() => import('../pages/HomeSwitcher').then(m => ({ default: m.HomeSwitcher })));
const ProfilePage = lazy(() => import('../pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const InsightsPage = lazy(() => import('../pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const GroupChatPage = lazy(() => import('../pages/GroupChatPage').then(m => ({ default: m.GroupChatPage })));
const CalendarPage = lazy(() => import('../pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const DailyFeedPage = lazy(() => import('../pages/DailyFeedPage').then(m => ({ default: m.DailyFeedPage })));
const ArticleDetailPage = lazy(() => import('../pages/ArticleDetailPage').then(m => ({ default: m.ArticleDetailPage })));
const VideoHistoryPage = lazy(() => import('../pages/VideoHistoryPage').then(m => ({ default: m.VideoHistoryPage })));
const PricingPageRoute = lazy(() => import('../pages/PricingPageRoute').then(m => ({ default: m.PricingPageRoute })));
const SuccessPage = lazy(() => import('../pages/SuccessPage').then(m => ({ default: m.SuccessPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BackgroundSettingsPage = lazy(() => import('../pages/BackgroundSettingsPage').then(m => ({ default: m.BackgroundSettingsPage })));
const BillingPage = lazy(() => import('../pages/BillingPage').then(m => ({ default: m.BillingPage })));
const CoAuthorPage = lazy(() => import('../pages/CoAuthorPage').then(m => ({ default: m.CoAuthorPage })));
const CoachingProgressPage = lazy(() => import('../pages/CoachingProgressPage').then(m => ({ default: m.CoachingProgressPage })));
const CoachingCommitmentsPage = lazy(() => import('../pages/CoachingCommitmentsPage').then(m => ({ default: m.CoachingCommitmentsPage })));
const CoachingLibraryPage = lazy(() => import('../pages/CoachingLibraryPage').then(m => ({ default: m.CoachingLibraryPage })));
const GoalDetailPage = lazy(() => import('../pages/GoalDetailPage').then(m => ({ default: m.GoalDetailPage })));
const RealOrNotPage = lazy(() => import('../pages/RealOrNotPage').then(m => ({ default: m.RealOrNotPage })));
const AtlasPage = lazy(() => import('../pages/AtlasPage').then(m => ({ default: m.AtlasPage })));
const LocalExplorerPage = lazy(() => import('../pages/LocalExplorerPage').then(m => ({ default: m.LocalExplorerPage })));
const InvitePage = lazy(() => import('../pages/InvitePage').then(m => ({ default: m.InvitePage })));
const MemoryTrainingPage = lazy(() => import('../pages/MemoryTrainingPage'));
const MorningJournalPage = lazy(() => import('../pages/MorningJournalPage').then(m => ({ default: m.MorningJournalPage })));
const PersonProfilePage = lazy(() => import('../pages/PersonProfilePage').then(m => ({ default: m.PersonProfilePage })));
const RelationshipBriefPage = lazy(() => import('../pages/RelationshipBriefPage').then(m => ({ default: m.RelationshipBriefPage })));
const CommunityPage = lazy(() => import('../pages/CommunityPage'));
const BoardPage = lazy(() => import('../pages/BoardPage'));
const PostDetailPage = lazy(() => import('../pages/PostDetailPage'));
const CommunitySearchPage = lazy(() => import('../pages/CommunitySearchPage'));
const MemberProfilePage = lazy(() => import('../pages/MemberProfilePage'));
const ProgressFeedPage = lazy(() => import('../pages/ProgressFeedPage'));
const DiscoverPage = lazy(() => import('../pages/DiscoverPage'));
const MyPublicProfilePage = lazy(() => import('../pages/MyPublicProfilePage'));
const EditPublicProfilePage = lazy(() => import('../pages/EditPublicProfilePage'));
const HousePage = lazy(() => import('../pages/HousePage'));
const WorldPage = lazy(() => import('../pages/WorldPage').then(m => ({ default: m.WorldPage })));
const BrowseSpacesPage = lazy(() => import('../pages/BrowseSpacesPage'));
const MedalsPage = lazy(() => import('../pages/MedalsPage'));
const ObjectivesLeaderboardPage = lazy(() => import('../pages/ObjectivesLeaderboardPage'));
const JoinInvitePage = lazy(() => import('../pages/JoinInvitePage'));
/** `activity`: what visiting this page counts toward in the daily objectives. */
function P(el: React.ReactNode, activity?: ReportedKey) {
  return (
    <ProtectedRoute>
      <RequireProfile>
        {activity && <ReportActivity activity={activity} />}
        <Suspense fallback={<RouteFallback />}>{el}</Suspense>
      </RequireProfile>
    </ProtectedRoute>
  );
}

export const appRoutes = [
  <Route key="lobby" path="/lobby" element={P(<HomeSwitcher />)} />,
  <Route key="profile" path="/profile" element={P(<ProfilePage />)} />,
  <Route key="insights" path="/insights" element={P(<InsightsPage />, 'check_insights')} />,
  <Route key="chat" path="/chat" element={P(<App />)} />,
  <Route key="group-chat" path="/group-chat" element={P(<GroupChatPage />)} />,
  <Route key="calendar" path="/calendar" element={P(<CalendarPage />, 'view_calendar')} />,
  <Route key="daily-feed" path="/daily-feed" element={P(<DailyFeedPage />, 'read_feed')} />,
  <Route key="article" path="/article" element={P(<ArticleDetailPage />)} />,
  <Route key="videos" path="/videos" element={P(<VideoHistoryPage />, 'watch_videos')} />,
  <Route key="pricing" path="/pricing" element={P(<PricingPageRoute />)} />,
  <Route key="coaching-progress" path="/coaching-progress" element={P(<CoachingProgressPage />, 'view_progress')} />,
  <Route key="coaching-commitments" path="/coaching-commitments" element={P(<CoachingCommitmentsPage />)} />,
  <Route key="coaching-library" path="/coaching-library" element={P(<CoachingLibraryPage />, 'coaching_library')} />,
  <Route key="goal-detail" path="/goal/:goalId" element={P(<GoalDetailPage />)} />,
  <Route key="co-author" path="/co-author" element={P(<CoAuthorPage />, 'use_co_author')} />,
  <Route key="atlas" path="/atlas" element={P(<AtlasPage />)} />,
  <Route key="local-explorer" path="/local-explorer" element={P(<LocalExplorerPage />)} />,
  <Route key="navi" path="/navi" element={P(<LocalExplorerPage />)} />,
  <Route key="person-profile" path="/person/:personId" element={P(<PersonProfilePage />)} />,
  <Route key="relationship-briefs" path="/relationship-briefs" element={P(<RelationshipBriefPage />)} />,
  <Route key="success" path="/success" element={P(<SuccessPage />)} />,
  <Route key="settings" path="/settings" element={P(<SettingsPage />)} />,
  <Route key="background-settings" path="/background-settings" element={P(<BackgroundSettingsPage />, 'change_background')} />,
  <Route key="billing" path="/billing" element={P(<BillingPage />)} />,
  <Route key="real-or-not" path="/real-or-not" element={P(<RealOrNotPage />, 'real_or_not')} />,
  <Route key="invite" path="/invite" element={P(<InvitePage />)} />,
  <Route key="memory-training" path="/memory-training" element={P(<MemoryTrainingPage />, 'memory_training')} />,
  <Route key="morning-journal" path="/morning-journal" element={P(<MorningJournalPage />)} />,
  <Route key="community" path="/community" element={P(<CommunityPage />, 'browse_spaces')} />,
  <Route key="community-board" path="/community/board/:boardId" element={P(<BoardPage />)} />,
  <Route key="community-post" path="/community/post/:postId" element={P(<PostDetailPage />)} />,
  <Route key="community-search" path="/community/search" element={P(<CommunitySearchPage />)} />,
  <Route key="member-profile" path="/member/:userId" element={P(<MemberProfilePage />, 'visit_neighbor')} />,
  <Route key="progress-feed" path="/feed" element={P(<ProgressFeedPage />)} />,
  <Route key="discover" path="/discover" element={P(<DiscoverPage />, 'discover_people')} />,
  <Route key="my-profile" path="/my-profile" element={P(<MyPublicProfilePage />)} />,
  <Route key="edit-public-profile" path="/my-profile/edit" element={P(<EditPublicProfilePage />, 'edit_profile')} />,
  <Route key="house" path="/house" element={P(<HousePage />)} />,
  <Route key="house-space" path="/house/:boardId" element={P(<HousePage />)} />,
  <Route key="house-room" path="/house/:boardId/:roomName" element={P(<HousePage />)} />,
  <Route key="house-browse" path="/house/browse" element={P(<BrowseSpacesPage />)} />,
  <Route key="world" path="/world" element={P(<WorldPage />)} />,
  <Route key="medals" path="/medals" element={P(<MedalsPage />, 'view_medals')} />,
  <Route key="leaderboard" path="/leaderboard" element={P(<ObjectivesLeaderboardPage />)} />,
  <Route key="join" path="/join/:code" element={P(<JoinInvitePage />)} />,
];
