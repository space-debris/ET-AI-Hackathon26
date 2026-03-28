import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, Shield } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { userApi } from '../../services/api';

export function SettingsPage() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'Delete all uploaded statement data, saved profile data, and cached report results from this browser session?'
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setMessage(null);
    setError(null);

    try {
      await userApi.clearAllData();
      setMessage('All saved data was deleted successfully. You can start fresh now.');
      navigate('/upload', { replace: true });
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeleting(false);
    }
  };

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
          {message ? (
            <p className="text-sm font-medium text-emerald-700">{message}</p>
          ) : null}
          {error ? (
            <p className="text-sm font-medium text-red-600">{error}</p>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            loading={deleting}
            onClick={handleDeleteAllData}
          >
            Delete All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default SettingsPage;
