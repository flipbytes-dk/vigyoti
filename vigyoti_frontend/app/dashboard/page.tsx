'use client';

import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, ExternalLink } from 'lucide-react';

const creditsMenu = [
  { description: 'Generate tweets using any source (10 tweets)', credits: 10 },
  { description: 'Generate 1 thread using any source (10 tweets)', credits: 10 },
  { description: 'Generate 1 AI video using open AI SORA', credits: 20 },
  { description: 'Generate 1 AI image', credits: 2 },
  { description: 'Rewrite 1 AI tweet using GPT 4.0', credits: 1 },
  { description: 'Storage 1 GB', credits: '2 per month' },
];

const subscriptionDetails = [
  { description: 'Connected X accounts', available: 1, used: 1 },
  { description: 'Monthly AI Credits', available: 100, used: 75 },
  { description: 'Workspaces', available: 2, used: 1 },
  { description: 'Team members', available: 5, used: 1 },
];

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <Card>
          <CardContent className="p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-2xl font-bold mb-2">Welcome to Vigyoti X</h2>
                <p className="text-gray-600 mb-4">
                  Welcome to Vigyoti X, and thank you for signing up! We highly recommend
                  watching this 2-minute video to learn how to make the most of the platform.
                  You'll love the results!
                </p>
                <Button className="gap-2">
                  <Play className="h-4 w-4" />
                  Watch Tutorial
                </Button>
              </div>
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <Play className="h-12 w-12 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credits Menu */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Credits Menu</h2>
            <Button variant="outline">See All Full Credits Menu</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Description</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Credits Needed</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {creditsMenu.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">Your Subscription</h2>
              <p className="text-sm text-gray-600">
                Your current subscription is: <span className="text-blue-600 font-medium">Basic</span>
              </p>
            </div>
            <Button>Upgrade</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">Description</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Available</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subscriptionDetails.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.available}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.used}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Events Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Events</h2>
            <Button variant="outline">Register For Webinar</Button>
          </div>
          <Card>
            <CardContent className="p-6">
              <p className="text-gray-600">
                Join our introductory webinar exploring the hints, tips and tricks within
                Vigyoti. Every weekday 6PM GMT ✨
              </p>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">FAQ's</h2>
            <Button variant="outline">See all FAQ's</Button>
          </div>
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-2">What are AI credits?</h3>
              <p className="text-gray-600">
                AI credits are used in Vigyoti whenever you regenerate content to rewrite or improve it, or if you
                generate images using AI. Rewriting or improving a tweet costs 1 credit, while generating images costs
                2 credits per image. To purchase AI credits, please visit the pricing page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 