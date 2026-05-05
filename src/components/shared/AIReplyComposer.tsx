/**
 * Shared AI Reply Composer Dialog
 *
 * Used by both LiveRepliesBoard (admin) and ClientPortalRepliesTab (client portal)
 * to generate and send AI-powered replies via Email Bison.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Send, RefreshCw, X, Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import type { LiveReply } from '@/hooks/useLiveReplies';
import { CcEmailEditor } from '@/components/shared/CcEmailEditor';
import { useWorkspaceCcSuggestions } from '@/hooks/useWorkspaceCcSuggestions';
import { useWorkspaceProducers } from '@/hooks/useWorkspaceProducers';

type ComposerStep = 'compose' | 'assigning';
const UNASSIGNED = 'unassigned';

export interface AIReplyComposerProps {
  open: boolean;
  onClose: () => void;
  reply: LiveReply;
  leadName: string;
  onReplySent?: () => void;
  // Optimistic update — flips the card to PENDING instantly when Send returns,
  // before any realtime/refetch has a chance to land.
  patchReplyAfterSend?: (replyUuid: string, sentReply: any) => void;
}

export function AIReplyComposer({ open, onClose, reply, leadName, onReplySent, patchReplyAfterSend }: AIReplyComposerProps) {
  const [generatedReply, setGeneratedReply] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [step, setStep] = useState<ComposerStep>('compose');
  const [selectedProducerId, setSelectedProducerId] = useState<string>(UNASSIGNED);
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();
  // Track whether we've already kicked off generation for this open session
  const hasGeneratedRef = useRef(false);

  const { suggestions: ccSuggestions } = useWorkspaceCcSuggestions(
    open ? reply.workspace_name : null,
  );
  const { producers } = useWorkspaceProducers(
    open ? reply.workspace_name : null,
  );

  // Auto-generate reply when dialog opens — only once per open session
  useEffect(() => {
    if (open && !hasGeneratedRef.current) {
      hasGeneratedRef.current = true;
      generateReply();
    }
    if (!open) {
      // Reset for next open
      hasGeneratedRef.current = false;
      setGeneratedReply('');
      setCcEmails([]);
      setStep('compose');
      setSelectedProducerId(UNASSIGNED);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Generate reply
  const generateReply = async () => {
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to generate replies',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/generate-ai-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0',
          },
          body: JSON.stringify({
            reply_uuid: reply.id,
            workspace_name: reply.workspace_name,
            lead_name: leadName,
            lead_email: reply.lead_email,
            lead_phone: reply.phone || undefined,
            original_message: reply.reply_text || '',
            preview_mode: true, // Don't save to DB yet
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate reply');
      }

      const data = await response.json();
      setGeneratedReply(data.generated_reply);
      setCcEmails(data.cc_emails || []);

      toast({
        title: 'Reply Generated',
        description: 'AI has generated a personalized reply based on the template',
      });
    } catch (error: any) {
      console.error('Error generating reply:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate reply',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!generatedReply.trim()) {
      toast({
        title: 'Empty Reply',
        description: 'Please generate a reply first',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Error',
          description: 'You must be logged in to send replies',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/send-reply-via-bison`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0',
          },
          body: JSON.stringify({
            reply_uuid: reply.id,
            workspace_name: reply.workspace_name,
            generated_reply_text: generatedReply,
            cc_emails: ccEmails,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Send failed (${response.status})`);
      }

      const responseData = await response.json();
      const verifiedAt = responseData.verified_at || new Date().toISOString();

      toast({
        title: 'Reply Sent!',
        description: `Reply sent to ${leadName}${ccEmails.length > 0 ? ` with ${ccEmails.length} CC(s)` : ''}`,
      });

      // Optimistic patch — flip the card to REPLIED (green) immediately.
      // The server stamps verified_at on success, so we use that value here.
      patchReplyAfterSend?.(reply.id, {
        id: 0,
        sent_at: verifiedAt,
        status: 'sent',
        sent_by: null,
        verified_at: verifiedAt,
        error_message: null,
        retry_count: 0,
        last_retry_at: null,
      });

      // Advance to producer-assignment step instead of closing.
      // Don't trigger an immediate refetch — it races the DB write and can
      // overwrite the optimistic patch, causing a PENDING flash.
      // The realtime subscription on sent_replies will sync the canonical
      // row when it lands (usually within 1-2 seconds).
      setStep('assigning');
    } catch (error: any) {
      console.error('Error sending reply:', error);
      const isNetworkError = !error.message || error.message === 'Failed to fetch' || error.message.includes('NetworkError');
      toast({
        title: 'Send Failed',
        description: isNetworkError
          ? 'Network error — reply was not sent. Please try again.'
          : error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleAssignProducer = async () => {
    if (selectedProducerId === UNASSIGNED) {
      onClose();
      return;
    }

    setIsAssigning(true);
    try {
      const producer = producers.find((p) => p.user_id === selectedProducerId);
      const producerName = producer?.full_name || null;

      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;

      const { error } = await supabase
        .from('client_leads')
        .update({
          assigned_to_user_id: selectedProducerId,
          assigned_to_name: producerName,
          assigned_at: new Date().toISOString(),
          assigned_by_user_id: currentUserId,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_name', reply.workspace_name)
        .eq('lead_email', reply.lead_email);

      if (error) throw error;

      toast({
        title: 'Producer assigned',
        description: producerName
          ? `${leadName} assigned to ${producerName}`
          : 'Lead assigned',
      });

      onClose();
    } catch (error: unknown) {
      console.error('Error assigning producer:', error);
      toast({
        title: 'Assignment failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to assign producer. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Reply to {leadName}
          </DialogTitle>
          <DialogDescription>
            {step === 'compose'
              ? 'Review the AI-generated reply and CC list before sending. You can add or remove CC recipients.'
              : 'Reply sent. Optionally assign this lead to a producer in your workspace.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'compose' ? (
          <div className="space-y-4 mt-4">
            {/* Original Message */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Original Message from {leadName}
              </label>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {reply.reply_text || '(No message text)'}
                </p>
              </div>
            </div>

            {/* Generated Reply */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                AI-Generated Reply
              </label>
              {isGenerating ? (
                <div className="bg-gray-50 rounded-lg p-8 border border-gray-200 flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600 mb-2" />
                  <p className="text-sm text-gray-600">Generating personalized reply...</p>
                </div>
              ) : (
                <Textarea
                  value={generatedReply}
                  onChange={(e) => setGeneratedReply(e.target.value)}
                  className="min-h-[200px] font-sans text-sm"
                  placeholder="AI-generated reply will appear here..."
                />
              )}
            </div>

            {/* CC Emails — editable */}
            <CcEmailEditor
              value={ccEmails}
              onChange={setCcEmails}
              suggestions={ccSuggestions}
              disabled={isGenerating || isSending}
            />

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={generateReply}
                disabled={isGenerating || isSending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isSending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={isGenerating || isSending || !generatedReply}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-900">Reply sent to {leadName}</p>
                {ccEmails.length > 0 && (
                  <p className="text-xs text-green-700 mt-0.5">
                    CC: {ccEmails.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {producers.length > 0 ? (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Assign this lead to a producer
                </label>
                <Select
                  value={selectedProducerId}
                  onValueChange={setSelectedProducerId}
                  disabled={isAssigning}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a producer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Don't assign</SelectItem>
                    {producers.map((producer) => (
                      <SelectItem key={producer.user_id} value={producer.user_id}>
                        {producer.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No producers available in this workspace.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isAssigning}
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={handleAssignProducer}
                disabled={isAssigning || producers.length === 0 || selectedProducerId === UNASSIGNED}
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign & Done'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
