import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { MessageSquare, Send } from 'lucide-react-native';
import { db } from '../../../../utils/api/supabase';
import CollapsibleCard from '../common/CollapsibleCard';

interface Comment {
  text: string;
  created_by: string;
  created_at: string;
  packer_name: string;
}

interface CommentsSectionProps {
  orderPackageId: string;
  editable?: boolean;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ orderPackageId, editable = true }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [orderPackageId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await db.query
        .from('order_packages')
        .select('comments')
        .eq('id', orderPackageId)
        .single();

      if (error) throw error;
      setComments((data?.comments as Comment[]) || []);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    const text = newComment.trim();
    if (!text) return;

    try {
      setSubmitting(true);

      // Get current user
      const { data: userData } = await db.auth.getUser();
      if (!userData?.user) throw new Error('User not authenticated');

      // Get user profile for name
      const { data: profile } = await db.query
        .from('profiles')
        .select('full_name')
        .eq('id', userData.user.id)
        .single();

      // Create new comment object
      const newCommentObj: Comment = {
        text,
        created_by: userData.user.id,
        created_at: new Date().toISOString(),
        packer_name: profile?.full_name || 'Unknown User',
      };

      // Append to existing comments
      const updatedComments = [...comments, newCommentObj];

      // Update in database
      const { error } = await db.query
        .from('order_packages')
        .update({ comments: updatedComments })
        .eq('id', orderPackageId);

      if (error) throw error;

      // Update local state
      setComments(updatedComments);
      setNewComment('');
    } catch (error: any) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', error.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <View className="mx-4 mt-4 mb-4">
      <CollapsibleCard 
        title="Comments" 
        containerClassName="border-gray-500 bg-white" 
        defaultOpen={false}
      >
        <View className="p-3">
          {/* Comments List */}
          {loading ? (
            <Text className="text-gray-500 text-center py-4">Loading comments...</Text>
          ) : comments.length === 0 ? (
            <View className="flex-row items-center justify-center py-6">
              <MessageSquare size={20} color="#9ca3af" />
              <Text className="text-gray-500 ml-2">No comments yet</Text>
            </View>
          ) : (
            <ScrollView className="max-h-80 mb-3" nestedScrollEnabled>
              {comments.map((comment, index) => (
                <View 
                  key={index} 
                  className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200"
                >
                  <View className="flex-row justify-between items-start mb-1">
                    <Text className="text-sm font-semibold text-gray-900">
                      {comment.packer_name}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {formatDate(comment.created_at)}
                    </Text>
                  </View>
                  <Text className="text-sm text-gray-700 leading-5">
                    {comment.text}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Add Comment Input */}
          {editable && (
            <View className="border-t border-gray-200 pt-3">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Add Comment
              </Text>
              <View className="flex-row items-end gap-2">
                <View className="flex-1">
                  <TextInput
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder="Type your comment..."
                  multiline
                  numberOfLines={3}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm"
                  style={{ minHeight: 60, maxHeight: 120, textAlignVertical: 'top' }}
                  editable={!submitting}
                />
              </View>
              <TouchableOpacity
                onPress={addComment}
                disabled={!newComment.trim() || submitting}
                className={`px-4 py-3 rounded-lg ${
                  !newComment.trim() || submitting
                    ? 'bg-gray-200'
                    : 'bg-blue-500'
                }`}
                style={{ height: 60 }}
              >
                <View className="items-center justify-center flex-1">
                  <Send 
                    size={20} 
                    color={!newComment.trim() || submitting ? '#9ca3af' : '#ffffff'} 
                  />
                  <Text 
                    className={`text-xs mt-1 ${
                      !newComment.trim() || submitting
                        ? 'text-gray-500'
                        : 'text-white'
                    }`}
                  >
                    {submitting ? 'Sending...' : 'Send'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
          )}
        </View>
      </CollapsibleCard>
    </View>
  );
};


// Memoized: primitive props — skips re-render when parent rebuilds tab JSX.
export default React.memo(CommentsSection);
