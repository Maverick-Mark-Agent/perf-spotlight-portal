/**
 * Live Replies Dashboard
 *
 * Real-time dashboard showing ALL replies (positive and negative)
 * from Email Bison workspaces with filtering and search capabilities
 */

import { useState, useMemo } from 'react';
import { useRealtimeReplies, useReplyWorkspaces } from '@/hooks/useRealtimeReplies';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, Search, Filter } from 'lucide-react';

export default function RepliesDashboard() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [selectedSentiment, setSelectedSentiment] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { workspaces, loading: workspacesLoading } = useReplyWorkspaces();
  const {
    data: replies,
    loading,
    error,
    newReplyCount,
    clearNewReplyCount,
    refreshData,
  } = useRealtimeReplies({
    workspaceName: selectedWorkspace,
    sentiment: selectedSentiment,
    limit: 200,
  });

  // Filter replies by search query
  const filteredReplies = useMemo(() => {
    if (!searchQuery.trim()) return replies;

    const query = searchQuery.toLowerCase();
    return replies.filter((reply) => {
      const leadName = [reply.first_name, reply.last_name].filter(Boolean).join(' ').toLowerCase();
      const email = reply.lead_email?.toLowerCase() || '';
      const company = reply.company?.toLowerCase() || '';
      const replyText = reply.reply_text?.toLowerCase() || '';

      return (
        leadName.includes(query) ||
        email.includes(query) ||
        company.includes(query) ||
        replyText.includes(query)
      );
    });
  }, [replies, searchQuery]);

  // Count by sentiment
  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, negative: 0, neutral: 0 };
    replies.forEach((reply) => {
      counts[reply.sentiment]++;
    });
    return counts;
  }, [replies]);

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge className="bg-green-500 hover:bg-green-600">Positive</Badge>;
      case 'negative':
        return <Badge className="bg-red-500 hover:bg-red-600">Negative</Badge>;
      case 'neutral':
        return <Badge className="bg-gray-500 hover:bg-gray-600">Neutral</Badge>;
      default:
        return <Badge variant="outline">{sentiment}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Live Replies Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Real-time feed of all replies from Email Bison workspaces
            </p>
          </div>
          <Button onClick={refreshData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Replies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{replies.length}</div>
              {newReplyCount > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  +{newReplyCount} new
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Positive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{sentimentCounts.positive}</div>
              <p className="text-xs text-gray-500 mt-1">
                {replies.length > 0 ? Math.round((sentimentCounts.positive / replies.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Negative</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{sentimentCounts.negative}</div>
              <p className="text-xs text-gray-500 mt-1">
                {replies.length > 0 ? Math.round((sentimentCounts.negative / replies.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Neutral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{sentimentCounts.neutral}</div>
              <p className="text-xs text-gray-500 mt-1">
                {replies.length > 0 ? Math.round((sentimentCounts.neutral / replies.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, company, or reply text..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Workspace Filter */}
              <div className="w-full md:w-64">
                <Select
                  value={selectedWorkspace || 'all'}
                  onValueChange={(value) => setSelectedWorkspace(value === 'all' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Workspaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Workspaces</SelectItem>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws} value={ws}>
                        {ws}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sentiment Filter */}
              <div className="w-full md:w-48">
                <Select
                  value={selectedSentiment}
                  onValueChange={(value: any) => setSelectedSentiment(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sentiments</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Replies List */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">Error loading replies: {error}</p>
            </CardContent>
          </Card>
        )}

        {loading && replies.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredReplies.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No replies found
                </h3>
                <p className="text-gray-500">
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'Replies will appear here as they come in from Email Bison'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredReplies.map((reply) => (
              <Card key={reply.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">
                          {[reply.first_name, reply.last_name].filter(Boolean).join(' ') || 'Unknown Lead'}
                        </CardTitle>
                        {getSentimentBadge(reply.sentiment)}
                        {reply.is_interested && (
                          <Badge className="bg-blue-500 hover:bg-blue-600">Interested</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>{reply.lead_email}</span>
                          {reply.company && <span>• {reply.company}</span>}
                          {reply.title && <span>• {reply.title}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            {reply.workspace_name}
                          </span>
                          <span>•</span>
                          <span>{formatDate(reply.reply_date)}</span>
                        </div>
                      </div>
                    </div>
                    {reply.bison_conversation_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(reply.bison_conversation_url!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {reply.reply_text || 'No reply text available'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Show "new replies" notification */}
        {newReplyCount > 0 && (
          <div className="fixed bottom-6 right-6">
            <Button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                clearNewReplyCount();
              }}
              className="shadow-lg"
            >
              {newReplyCount} new {newReplyCount === 1 ? 'reply' : 'replies'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
