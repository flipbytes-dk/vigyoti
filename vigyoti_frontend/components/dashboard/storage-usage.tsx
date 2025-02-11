import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StorageUsageService } from '@/services/storage-usage';
import { HardDrive } from 'lucide-react';

interface StorageUsageProps {
  userId: string;
}

export function StorageUsage({ userId }: StorageUsageProps) {
  const [usage, setUsage] = useState<{
    used: number;
    total: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    const fetchStorageUsage = async () => {
      try {
        const storageUsage = await StorageUsageService.getStorageUsage(userId);
        setUsage(storageUsage);
      } catch (error) {
        console.error('Error fetching storage usage:', error);
      }
    };

    if (userId) {
      fetchStorageUsage();
    }
  }, [userId]);

  if (!usage) return null;

  const formattedUsed = StorageUsageService.formatStorageSize(usage.used);
  const formattedTotal = StorageUsageService.formatStorageSize(usage.total);
  const isNearLimit = usage.percentage >= 80;
  const isOverLimit = usage.percentage >= 95;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Storage Usage</h3>
          <p className="text-sm text-gray-500">Track your storage consumption</p>
        </div>
        <div className="p-2 bg-blue-50 rounded-lg">
          <HardDrive className="h-5 w-5 text-blue-500" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Used: {formattedUsed}</span>
          <span className="text-gray-600">Total: {formattedTotal}</span>
        </div>

        <Progress 
          value={usage.percentage} 
          className={`h-2 ${
            isOverLimit 
              ? 'bg-red-500' 
              : isNearLimit 
                ? 'bg-yellow-500' 
                : 'bg-blue-500'
          }`}
        />

        {isNearLimit && (
          <p className={`text-sm ${isOverLimit ? 'text-red-500' : 'text-yellow-500'}`}>
            {isOverLimit 
              ? 'Storage limit reached! Please upgrade your plan or delete some files.'
              : 'You are approaching your storage limit. Consider upgrading your plan.'}
          </p>
        )}
      </div>
    </Card>
  );
} 