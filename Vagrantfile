# -*- mode: ruby -*-
# vi: set ft=ruby :
#
# Vagrantfile for lib.reviews
#
Vagrant.configure('2') do |config|
  config.vm.box = 'debian/jessie64'

  config.vm.post_up_message = <<-END
    To view logs, run 'vagrant ssh', then 'journalctl -u lib-reviews.service'.
    To restart lib-reviews, run 'sudo systemctl restart lib-reviews'.
    lib.reviews is available at http://localhost:8080 (on the host).
  END

  config.vm.network :private_network, ip: '10.11.12.13'

  # Make lib.reviews reachable via http://localhost:8080/ on the host.
  config.vm.network :forwarded_port, guest: 80, host: 8080

  config.vm.synced_folder '.', '/vagrant', type: 'nfs'

  # The debian/jessie64 box doesn't come with Puppet pre-installed,
  # so we need to run the shell provisioner first.
  config.vm.provision 'shell', inline: '/usr/bin/apt-get install -y puppet'

  config.vm.provision 'puppet' do |puppet|
    # Uncomment the line below to make Puppet runs vebrose:
    # puppet.options = '--verbose --debug'
  end
end
