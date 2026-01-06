/**
 * Client Portal Template Editor
 *
 * Allows clients to view and edit their workspace's AI reply templates.
 * Adapted from ReplyTemplatesTab for client portal use.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, X, Plus, Info, Loader2, Sparkles } from 'lucide-react';

interface ReplyTemplate {
  id: number;
  workspace_name: string;
  template_text_with_phone: string;
  template_text_no_phone: string;
  cc_emails: string[];
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientPortalTemplateEditorProps {
  workspaceName: string;
}

export function ClientPortalTemplateEditor({ workspaceName }: ClientPortalTemplateEditorProps) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<ReplyTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [templateWithPhone, setTemplateWithPhone] = useState('');
  const [templateNoPhone, setTemplateNoPhone] = useState('');
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Load template on mount
  useEffect(() => {
    fetchTemplate();
  }, [workspaceName]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reply_templates')
        .select('*')
        .eq('workspace_name', workspaceName)
        .maybeSingle();

      if (error) {
        console.error('Error fetching template:', error);
        toast({
          title: 'Error',
          description: 'Failed to load template',
          variant: 'destructive',
        });
        return;
      }

      if (data) {
        setTemplate(data);
        setTemplateWithPhone(data.template_text_with_phone);
        setTemplateNoPhone(data.template_text_no_phone);
        setCcEmails(data.cc_emails || []);
        setSpecialInstructions(data.special_instructions || '');
      } else {
        // No template exists yet - set defaults
        setTemplateWithPhone('');
        setTemplateNoPhone('');
        setCcEmails([]);
        setSpecialInstructions('');
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const templateData = {
        workspace_name: workspaceName,
        template_text_with_phone: templateWithPhone,
        template_text_no_phone: templateNoPhone,
        cc_emails: ccEmails,
        special_instructions: specialInstructions || null,
      };

      const { error } = await supabase
        .from('reply_templates')
        .upsert(templateData, { onConflict: 'workspace_name' });

      if (error) throw error;

      toast({
        title: 'Template Saved',
        description: 'Your reply template has been updated successfully',
      });

      setHasChanges(false);
      fetchTemplate(); // Refresh to get updated timestamps
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addCcEmail = () => {
    if (!newEmail.trim()) return;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    if (ccEmails.includes(newEmail)) {
      toast({
        title: 'Duplicate Email',
        description: 'This email is already in the CC list',
        variant: 'destructive',
      });
      return;
    }

    setCcEmails([...ccEmails, newEmail]);
    setNewEmail('');
    setHasChanges(true);
  };

  const removeCcEmail = (emailToRemove: string) => {
    setCcEmails(ccEmails.filter(email => email !== emailToRemove));
    setHasChanges(true);
  };

  const handleTemplateChange = (field: 'with_phone' | 'no_phone' | 'instructions', value: string) => {
    setHasChanges(true);
    if (field === 'with_phone') {
      setTemplateWithPhone(value);
    } else if (field === 'no_phone') {
      setTemplateNoPhone(value);
    } else {
      setSpecialInstructions(value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">AI Reply System</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                These templates are used by AI to generate personalized replies to your leads.
                The system automatically selects the appropriate template based on whether the lead provided a phone number.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template with Phone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template with Phone Number</CardTitle>
          <CardDescription>
            Used when the lead provides a phone number. Use <code className="bg-muted px-1 py-0.5 rounded text-xs">{'{phone_number}'}</code> placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={templateWithPhone}
              onChange={(e) => handleTemplateChange('with_phone', e.target.value)}
              placeholder={`Great! I will work this up for you.\n\nIs {phone_number} a good number to reach you?\n\nThanks,\n${workspaceName}`}
              className="min-h-[180px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {templateWithPhone.length} characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Template without Phone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template without Phone Number</CardTitle>
          <CardDescription>
            Used when the lead doesn't provide a phone number. Ask for their contact information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={templateNoPhone}
              onChange={(e) => handleTemplateChange('no_phone', e.target.value)}
              placeholder={`Great! I will work this up for you.\n\nWhat is the best number to reach you?\n\nThanks,\n${workspaceName}`}
              className="min-h-[180px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {templateNoPhone.length} characters
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CC Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CC Email Recipients</CardTitle>
          <CardDescription>
            All AI-generated replies will automatically CC these email addresses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/50">
            {ccEmails.length === 0 ? (
              <span className="text-sm text-muted-foreground">No CC recipients configured</span>
            ) : (
              ccEmails.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1">
                  {email}
                  <button
                    onClick={() => removeCcEmail(email)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCcEmail()}
              placeholder="email@example.com"
              type="email"
            />
            <Button onClick={addCcEmail} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {ccEmails.length > 5 && (
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Info className="h-4 w-4" />
              Warning: {ccEmails.length} CC recipients may trigger spam filters. Consider reducing to 5 or fewer.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Special Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Special Instructions (Internal Notes)</CardTitle>
          <CardDescription>
            Internal notes for your team. Not visible to leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={specialInstructions}
            onChange={(e) => handleTemplateChange('instructions', e.target.value)}
            placeholder="e.g., Always CC the sales manager on replies..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* Supported Placeholders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supported Placeholders</CardTitle>
          <CardDescription>
            Use these placeholders in your templates for automatic substitution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{'{first_name}'}</code>
              <span className="text-sm text-muted-foreground">Lead's first name (auto-extracted from full name)</span>
            </div>
            <div className="flex items-start gap-2">
              <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{'{phone_number}'}</code>
              <span className="text-sm text-muted-foreground">Lead's phone number (only available in "with phone" template)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
        <div className="text-sm">
          {hasChanges ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">You have unsaved changes</span>
          ) : (
            <span className="text-muted-foreground">All changes saved</span>
          )}
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </>
          )}
        </Button>
      </div>

      {template && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(template.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
