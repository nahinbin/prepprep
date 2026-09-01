"use client";

import { useState, useTransition } from "react";
import { searchFriend, sendFriendRequest } from "@/app/actions/friends";
import { Search, UserPlus, Check, User as UserIcon } from "lucide-react";
import Link from "next/link";

export function FriendSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim().length === 0) {
      setResults([]);
      return;
    }

    startTransition(async () => {
      const { users } = await searchFriend(value);
      setResults(users || []);
    });
  };

  const handleSendRequest = async (username: string) => {
    setSentRequests(new Set([...sentRequests, username]));
    await sendFriendRequest(username);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search for players..."
          value={query}
          onChange={handleSearch}
          className="w-full pl-12 pr-4 py-4 rounded-3xl bg-card border-2 border-border focus:border-primary focus:bg-background transition-all outline-none font-bold shadow-sm"
        />
        {isPending && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border-2 border-border shadow-xl rounded-3xl overflow-hidden z-20 divide-y divide-border/50">
          {results.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <Link href={`/profile/${user.username}`} className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-muted border border-border/50 overflow-hidden flex items-center justify-center shrink-0">
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-foreground leading-none">{user.username}</p>
                  {user.name && <p className="text-xs font-medium text-muted-foreground mt-0.5">{user.name}</p>}
                </div>
              </Link>

              {sentRequests.has(user.username) ? (
                <button disabled className="p-2 rounded-xl bg-success/10 text-success font-bold flex items-center gap-2 text-sm border border-success/20">
                  <Check className="w-4 h-4" /> Sent
                </button>
              ) : (
                <button 
                  onClick={() => handleSendRequest(user.username)}
                  className="p-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold transition-colors border border-primary/20 hover:border-primary"
                  aria-label="Send Friend Request"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
