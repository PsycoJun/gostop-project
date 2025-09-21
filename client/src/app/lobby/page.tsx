'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, LogOut } from 'lucide-react';
import styles from './page.module.css';

export default function LobbyPage() {
  const { user, token, logout, loading } = useAuth();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!token) return;

    const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, { 
      path: '/socket.io/',
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      if (user && reason !== 'io client disconnect') {
        alert('서버와의 연결이 끊어졌습니다. 다시 로그인해주세요.');
        router.push('/login');
      }
    });

    newSocket.on('lobbyUpdate', ({ roomList, playerList }) => {
      setRooms(roomList || []);
      setOnlineUsers(playerList?.length || 0);
    });

    newSocket.on('roomCreated', ({ roomId }) => {
      router.push(`/room?id=${roomId}`);
    });

    newSocket.on('gameError', (message) => {
      alert(`Error: ${message}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, loading, token, router]);

  const handleCreateRoom = () => {
    socket?.emit('createRoom');
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(`/room?id=${roomId}`);
  };

  if (loading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.lobbyContainer}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.logoIconContainer}>
              <span className="text-2xl">🎴</span>
            </div>
            <div>
              <h1 className={styles.lobbyTitle}>고스톱 Lobby</h1>
              <p className={styles.welcomeText}>Welcome, {user?.username}!</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <Badge variant="secondary" className={styles.onlineUsersBadge}>
              <Users className={styles.onlineUsersIcon} />
              Online: {onlineUsers}
            </Badge>
            <Button onClick={logout} variant="ghost" size="sm" className={styles.logoutButton}>
              <LogOut className={styles.logoutIcon}/>
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <Button onClick={handleCreateRoom} className={styles.createRoomButton}>
          <Plus className={styles.createRoomIcon} />
          Create New Room
        </Button>

        <div className={styles.roomsSection}>
          <h2 className={styles.roomsTitle}>Available Rooms</h2>
          {rooms.map((room: any) => (
            <Card key={room.id} className={styles.roomCard}>
              <CardContent className={styles.roomCardContent}>
                <div className={styles.roomCardInner}>
                  <div className={styles.roomInfo}>
                    <h3 className={styles.roomName}>Room {room.id.substring(0, 4)}</h3>
                    <div className={styles.playerCountContainer}>
                      <Badge variant="secondary" className={styles.playerCountBadge}>
                        <Users className={styles.playerCountIcon} />
                        {room.playerCount}/4
                      </Badge>
                    </div>
                  </div>
                  <Button onClick={() => handleJoinRoom(room.id)} disabled={room.playerCount >= 4} className={styles.joinButton}>
                    Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
