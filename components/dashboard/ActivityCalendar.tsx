'use client';

// CocoaTrack V2 - Activity Calendar Widget
// Shows recent activity in a calendar heatmap style

import { useMemo } from 'react';

interface ActivityDay {
  date: string;
  count: number;
}

interface ActivityCalendarProps {
  data?: ActivityDay[];
  loading?: boolean;
}

// Generate last 35 days (5 weeks)
function generateDays(): string[] {
  const days: string[] = [];
  const today = new Date();
  
  for (let i = 34; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }
  
  return days;
}

function getIntensityClass(count: number): string {
  if (count === 0) return 'bg-gray-100';
  if (count <= 2) return 'bg-emerald-200';
  if (count <= 5) return 'bg-emerald-400';
  if (count <= 10) return 'bg-emerald-500';
  return 'bg-emerald-600';
}

const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function CalendarSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square rounded bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

export function ActivityCalendar({ data = [], loading = false }: ActivityCalendarProps) {
  const days = useMemo(() => generateDays(), []);
  
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => map.set(d.date, d.count));
    return map;
  }, [data]);

  // Get month labels
  const monthLabels = useMemo(() => {
    const labels: { month: string; startIndex: number }[] = [];
    let currentMonth = '';
    
    days.forEach((day, index) => {
      const month = new Date(day).toLocaleDateString('fr-FR', { month: 'short' });
      if (month !== currentMonth) {
        currentMonth = month;
        labels.push({ month, startIndex: index });
      }
    });
    
    return labels;
  }, [days]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activité récente</h3>
        <CalendarSkeleton />
      </div>
    );
  }

  // Calculate total for the period
  const totalDeliveries = data.reduce((sum, d) => sum + d.count, 0);
  const activeDays = data.filter(d => d.count > 0).length;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Activité récente</h3>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{totalDeliveries} livraisons</p>
          <p className="text-xs text-gray-500">{activeDays} jours actifs</p>
        </div>
      </div>

      {/* Week day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const count = activityMap.get(day) || 0;
          const date = new Date(day);
          const isToday = day === new Date().toISOString().split('T')[0];
          
          return (
            <div
              key={day}
              className={`aspect-square rounded-sm ${getIntensityClass(count)} ${
                isToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''
              } transition-all hover:scale-110 cursor-default group relative`}
              title={`${date.toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}: ${count} livraison${count !== 1 ? 's' : ''}`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {count} livraison{count !== 1 ? 's' : ''}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
        <span>Moins</span>
        <div className="flex gap-0.5">
          <div className="w-3 h-3 rounded-sm bg-gray-100" />
          <div className="w-3 h-3 rounded-sm bg-emerald-200" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <div className="w-3 h-3 rounded-sm bg-emerald-600" />
        </div>
        <span>Plus</span>
      </div>
    </div>
  );
}
