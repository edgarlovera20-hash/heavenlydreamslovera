import React, { useState, useRef } from 'react';
import { ImagePlus, Send, Heart, ThumbsUp, MessageCircle, X, User } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Post {
  id: string;
  author: string;
  avatar?: string;
  time: string;
  content: string;
  image?: string;
  likes: number;
  hearts: number;
  comments: number;
  userReacted?: 'like' | 'heart' | null;
}

export default function Announcements() {
  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      author: 'Edgar Lovera',
      time: 'Hace 2 horas',
      content: '¡Excelente trabajo equipo! Hemos superado la meta de ventas de esta semana. Sigamos con este gran ritmo. 🚀',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=800&h=400',
      likes: 12,
      hearts: 5,
      comments: 3,
    },
    {
      id: '2',
      author: 'Recursos Humanos',
      time: 'Ayer a las 14:30',
      content: 'Les recordamos que el próximo viernes tendremos nuestra reunión mensual de resultados. Por favor confirmen su asistencia.',
      likes: 8,
      hearts: 1,
      comments: 0,
      userReacted: 'like',
    }
  ]);

  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostSubmit = () => {
    if (!newPostContent.trim() && !selectedImage) return;

    const newPost: Post = {
      id: Date.now().toString(),
      author: 'Edgar Lovera', // Current user
      time: 'Justo ahora',
      content: newPostContent,
      image: selectedImage || undefined,
      likes: 0,
      hearts: 0,
      comments: 0,
    };

    setPosts([newPost, ...posts]);
    setNewPostContent('');
    setSelectedImage(null);
  };

  const handleReaction = (postId: string, type: 'like' | 'heart') => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        // If already reacted with this type, remove reaction
        if (post.userReacted === type) {
          return {
            ...post,
            [type === 'like' ? 'likes' : 'hearts']: post[type === 'like' ? 'likes' : 'hearts'] - 1,
            userReacted: null
          };
        }
        
        // If reacted with different type, switch reaction
        let newLikes = post.likes;
        let newHearts = post.hearts;
        
        if (post.userReacted === 'like') newLikes--;
        if (post.userReacted === 'heart') newHearts--;
        
        if (type === 'like') newLikes++;
        if (type === 'heart') newHearts++;

        return {
          ...post,
          likes: newLikes,
          hearts: newHearts,
          userReacted: type
        };
      }
      return post;
    }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 mb-1 tracking-tight">Anuncios y Comunicados</h1>
        <p className="text-slate-400 text-sm">Comparte actualizaciones, fotos y noticias con todo el equipo.</p>
      </div>

      {/* Create Post Form */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50 shrink-0">
            <User className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 space-y-4">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="¿Qué quieres compartir con el equipo?"
              className="w-full bg-transparent border-none text-slate-200 placeholder:text-slate-500 resize-none focus:ring-0 p-0 min-h-[60px] text-[15px]"
            />
            
            {selectedImage && (
              <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/50">
                <img src={selectedImage} alt="Preview" className="w-full max-h-[300px] object-contain" />
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageSelect}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Añadir Foto
              </button>
              
              <button 
                onClick={handlePostSubmit}
                disabled={!newPostContent.trim() && !selectedImage}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                <Send className="w-4 h-4" />
                Publicar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            {/* Post Header */}
            <div className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 shrink-0">
                {post.avatar ? (
                  <img src={post.avatar} alt={post.author} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-slate-300">{post.author.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 text-[15px]">{post.author}</h3>
                <p className="text-xs text-slate-500">{post.time}</p>
              </div>
            </div>

            {/* Post Content */}
            <div className="px-5 pb-4">
              <p className="text-slate-300 text-[15px] whitespace-pre-wrap leading-relaxed">
                {post.content}
              </p>
            </div>

            {/* Post Image */}
            {post.image && (
              <div className="w-full border-y border-white/5 bg-black/20">
                <img src={post.image} alt="Post attachment" className="w-full max-h-[400px] object-cover" />
              </div>
            )}

            {/* Reactions Bar */}
            <div className="px-5 py-3 flex items-center gap-6 border-t border-white/5 bg-slate-950/85">
              <button 
                onClick={() => handleReaction(post.id, 'like')}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  post.userReacted === 'like' ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                )}
              >
                <ThumbsUp className={cn("w-5 h-5", post.userReacted === 'like' && "fill-blue-400/20")} />
                {post.likes > 0 && <span>{post.likes}</span>}
              </button>
              
              <button 
                onClick={() => handleReaction(post.id, 'heart')}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  post.userReacted === 'heart' ? "text-pink-500" : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Heart className={cn("w-5 h-5", post.userReacted === 'heart' && "fill-pink-500/20")} />
                {post.hearts > 0 && <span>{post.hearts}</span>}
              </button>

              <button className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors ml-auto">
                <MessageCircle className="w-5 h-5" />
                {post.comments > 0 && <span>{post.comments}</span>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
