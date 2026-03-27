import { Settings as SettingsIcon, Bell, User, Shield, Palette } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-gray-500" />
            <CardTitle>Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Email Address</p>
              <p className="text-sm text-gray-500">user@example.com</p>
            </div>
            <Button variant="ghost" size="sm">Edit</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Phone Number</p>
              <p className="text-sm text-gray-500">+91 98765 43210</p>
            </div>
            <Button variant="ghost" size="sm">Edit</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-gray-500" />
            <CardTitle>Notifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Email Notifications</p>
              <p className="text-sm text-gray-500">Receive portfolio updates via email</p>
            </div>
            <input type="checkbox" defaultChecked className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Weekly Digest</p>
              <p className="text-sm text-gray-500">Get weekly portfolio summary</p>
            </div>
            <input type="checkbox" defaultChecked className="h-5 w-5 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-gray-500" />
            <CardTitle>Privacy & Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Data Storage</p>
              <p className="text-sm text-gray-500">Your data is processed locally and never stored on our servers</p>
            </div>
          </div>
          <Button variant="danger" size="sm">Delete All Data</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
