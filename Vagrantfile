# -*- mode: ruby -*-
# vi: set ft=ruby :
#
# Vagrantfile for lib.reviews
#
Vagrant.configure('2') do |config|
  config.vm.box = 'debian/stretch64'

  config.vm.post_up_message = <<-END
    To view logs, run 'vagrant ssh', then 'journalctl -u lib-reviews.service'.
    To restart lib-reviews, run 'sudo systemctl restart lib-reviews'.
    lib.reviews is available at http://localhost:8000 (on the host).
  END

  config.vm.network :private_network, ip: '10.11.12.13'

  # Make lib.reviews reachable via http://localhost:8000/ on the host.
  config.vm.network :forwarded_port, guest: 8000, host: 8000

  config.vm.synced_folder '.', '/vagrant',
    type: 'nfs',
    nfs_version: 4,
    nfs_udp: false,
    linux__nfs_options: ['rw']

  # The debian/jessie64 box doesn't come with Puppet pre-installed,
  # so we need to run the shell provisioner first.
  config.vm.provision 'shell', run: 'always', inline: %{
    DEBIAN_FRONTEND=noninteractive apt-get install -q -y puppet
    install -o vagrant -g vagrant -d /srv/node_modules
    mount --bind /srv/node_modules /vagrant/node_modules
  }

  config.vm.provision 'puppet', run: 'always' do |puppet|
    # Uncomment the line below to make Puppet runs vebrose:
    # puppet.options = '--verbose --debug'
  end
end
